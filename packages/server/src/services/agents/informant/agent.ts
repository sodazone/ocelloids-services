import { Operation } from 'rfc6902'
import { filter as rxFilter } from 'rxjs'
import { z } from 'zod'

import { asSerializable, ControlQuery } from '@/common/index.js'
import { ValidationError } from '@/errors.js'
import { Egress } from '@/services/egress/hub.js'
import { extractEvmLogs, extractEvmTransactions } from '@/services/networking/substrate/rx/evm.js'
import { RxSubscriptionWithId, Subscription } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN } from '@/services/types.js'

import { SubstrateSharedStreams } from '../../networking/substrate/shared.js'
import { hasOp, SubscriptionUpdater } from '../base/updater.js'

import { Agent, AgentMetadata, AgentRuntimeContext, getAgentCapabilities, Subscribable } from '../types.js'

export const $InformantInputs = z.object({
  networks: z.array(
    z
      .string({
        required_error: 'Network URNs are required, e.g. "urn:ocn:polkadot:0"',
      })
      .min(1),
  ),
  filter: z.object({
    type: z.enum(['event', 'extrinsic']),
    match: z.record(z.any(), z.any()),
    evm: z.optional(
      z.array(
        z.object({
          abi: z.array(z.any()),
          addresses: z.array(z.string()),
        }),
      ),
    ),
  }),
})

export type InformantInputs = z.infer<typeof $InformantInputs>

type InformantHandler = {
  streams: RxSubscriptionWithId[]
  control: ControlQuery
  subscription: Subscription<InformantInputs>
}

/**
 * Informant agent.
 *
 * Fetches transactions and events using custom MongoQL-compatible filtering expressions.
 */
export class InformantAgent implements Agent, Subscribable {
  readonly #log: Logger
  readonly #shared: SubstrateSharedStreams
  readonly #handlers: Record<string, InformantHandler>
  readonly #egress: Egress
  readonly #updater: SubscriptionUpdater

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log
    this.#shared = SubstrateSharedStreams.instance(ctx.ingress.substrate)
    this.#updater = new SubscriptionUpdater(ctx.ingress, [
      '/args/networks',
      '/args/filter',
      '/channels',
      '/public',
    ])
    this.#egress = ctx.egress
    this.#handlers = {}
  }

  get id(): string {
    return 'informant'
  }

  get metadata(): AgentMetadata {
    return {
      name: 'General Informant',
      description: 'Fetches transactions and events using custom MongoQL-compatible filtering expressions.',
      capabilities: getAgentCapabilities(this),
    }
  }

  get inputSchema(): z.ZodSchema {
    return $InformantInputs
  }

  subscribe(subscription: Subscription<InformantInputs>): void {
    this.#checkValidFilter(subscription.args.filter.match)

    const handler = this.#monitor(subscription)

    this.#handlers[subscription.id] = handler
  }

  unsubscribe(subscriptionId: string) {
    const handler = this.#handlers[subscriptionId]
    if (handler) {
      handler.streams.forEach(({ sub }) => {
        sub.unsubscribe()
      })
      delete this.#handlers[subscriptionId]
    }
  }

  update(subscriptionId: string, patch: Operation[]): Subscription {
    const toUpdate = this.#updater.prepare<InformantInputs>({
      handler: this.#handlers[subscriptionId],
      patch,
      argsSchema: $InformantInputs,
    })

    if (hasOp(patch, '/args/networks')) {
      this.#updateNetworks(toUpdate)
    }

    if (hasOp(patch, '/args/filter')) {
      this.#updateFilter(toUpdate)
    }

    // Update in-memory handler
    this.#handlers[subscriptionId].subscription = toUpdate

    return toUpdate
  }

  stop() {
    for (const handler of Object.values(this.#handlers)) {
      this.#log.info('[agent:%s] unsubscribe %s', this.id, handler.subscription.id)
      handler.streams.forEach(({ sub }) => {
        sub.unsubscribe()
      })
    }
  }

  start(subscriptions: Subscription<InformantInputs>[] = []): void {
    this.#log.info('[agent:%s] start subscriptions (%d)', this.id, subscriptions.length)

    for (const sub of subscriptions) {
      try {
        this.#handlers[sub.id] = this.#monitor(sub)
      } catch (err) {
        this.#log.error(err, '[agent:%s] unable to create subscription: %j', this.id, sub)
      }
    }
  }

  collectTelemetry(): void {
    //
  }

  getSubscriptionHandler(id: string) {
    return this.#handlers[id]
  }

  #monitor(subscription: Subscription<InformantInputs>): InformantHandler {
    const {
      args: { networks, filter },
    } = subscription

    const streams: RxSubscriptionWithId[] = []
    const control = ControlQuery.from(filter.match)

    try {
      for (const network of networks) {
        const chainId = network as NetworkURN

        this.#shared.checkSupportedNetwork(chainId)

        if (filter.type === 'extrinsic') {
          streams.push(
            this.#createExtrinsicSubscription({
              chainId,
              subscription,
              control,
            }),
          )
        } else {
          streams.push(
            this.#createEventSubscription({
              chainId,
              subscription,
              control,
            }),
          )
        }
      }

      return {
        subscription,
        streams,
        control,
      }
    } catch (error) {
      // clean up
      streams.forEach(({ sub }) => {
        sub.unsubscribe()
      })
      throw error
    }
  }

  #createEventSubscription({
    chainId,
    subscription,
    control,
  }: {
    control: ControlQuery
    chainId: NetworkURN
    subscription: Subscription<InformantInputs>
  }) {
    const {
      id,
      args: { filter },
    } = subscription

    if (filter.evm) {
      const { evm } = filter
      return {
        id: chainId,
        sub: this.#shared
          .blockEvents(chainId)
          .pipe(
            extractEvmLogs(evm),
            rxFilter((blockEvent) => control.value.test(blockEvent)),
          )
          .subscribe({
            error: (error: any) => {
              this.#log.error(error, '[%s:%s] error on network subscription %s', this.id, chainId, id)
            },
            next: (msg) => {
              try {
                this.#egress.publish(subscription, {
                  metadata: {
                    type: 'event',
                    subscriptionId: id,
                    agentId: this.id,
                    networkId: chainId,
                    timestamp: Date.now(),
                    blockTimestamp: msg.timestamp,
                  },
                  payload: asSerializable(msg),
                })
              } catch (error) {
                this.#log.error(error, '[%s:%s] error on notify EVM event (%s)', this.id, chainId, id)
              }
            },
          }),
      }
    } else {
      return {
        id: chainId,
        sub: this.#shared
          .blockEvents(chainId)
          .pipe(rxFilter((blockEvent) => control.value.test(blockEvent)))
          .subscribe({
            error: (error: any) => {
              this.#log.error(error, '[%s:%s] error on network subscription %s', this.id, chainId, id)
            },
            next: (msg) => {
              try {
                this.#egress.publish(subscription, {
                  metadata: {
                    type: 'event',
                    subscriptionId: id,
                    agentId: this.id,
                    networkId: chainId,
                    timestamp: Date.now(),
                    blockTimestamp: msg.timestamp,
                  },
                  payload: msg,
                })
              } catch (error) {
                this.#log.error(error, '[%s:%s] error on notify event (%s)', this.id, chainId, id)
              }
            },
          }),
      }
    }
  }

  #createExtrinsicSubscription({
    chainId,
    subscription,
    control,
  }: {
    control: ControlQuery
    chainId: NetworkURN
    subscription: Subscription<InformantInputs>
  }) {
    const {
      id,
      args: { filter },
    } = subscription

    if (filter.evm) {
      const { evm } = filter
      return {
        id: chainId,
        sub: this.#shared
          .blockExtrinsics(chainId)
          .pipe(
            extractEvmTransactions(evm),
            rxFilter((tx) => control.value.test(tx)),
          )
          .subscribe({
            error: (error: any) => {
              this.#log.error(error, '[%s:%s] error on network subscription %s', this.id, chainId, id)
            },
            next: (tx) => {
              try {
                this.#egress.publish(subscription, {
                  metadata: {
                    type: 'evm-extrinsic',
                    subscriptionId: id,
                    agentId: this.id,
                    networkId: chainId,
                    timestamp: Date.now(),
                    blockTimestamp: tx.timestamp,
                  },
                  payload: asSerializable(tx),
                })
              } catch (error) {
                this.#log.error(error, '[%s:%s] error on notify EVM extrinsic (%s)', this.id, chainId, id)
              }
            },
          }),
      }
    } else {
      return {
        id: chainId,
        sub: this.#shared
          .blockExtrinsics(chainId)
          .pipe(rxFilter((extrinsic) => control.value.test(extrinsic)))
          .subscribe({
            error: (error: any) => {
              this.#log.error(error, '[%s:%s] error on network subscription %s', this.id, chainId, id)
            },
            next: (extrinsic) => {
              try {
                this.#egress.publish(subscription, {
                  metadata: {
                    type: 'extrinsic',
                    subscriptionId: id,
                    agentId: this.id,
                    networkId: chainId,
                    timestamp: Date.now(),
                    blockTimestamp: extrinsic.timestamp,
                  },
                  payload: {
                    events: extrinsic.events.map((e) => e),
                    dispatchInfo: extrinsic.dispatchInfo,
                    dispatchError: extrinsic.dispatchError,
                    extrinsic: extrinsic,
                  },
                })
              } catch (error) {
                this.#log.error(error, '[%s:%s] error on notify extrinsic (%s)', this.id, chainId, id)
              }
            },
          }),
      }
    }
  }

  async #updateFilter(toUpdate: Subscription<InformantInputs>) {
    const {
      id,
      args: {
        filter: { match },
      },
    } = toUpdate

    const { control } = this.#handlers[id]

    this.#checkValidFilter(match)
    control.change(match)
  }

  #updateNetworks(toUpdate: Subscription<InformantInputs>) {
    const { id } = toUpdate

    // Subscribe to new if any
    const { streams } = this.#handlers[id]
    const { streams: newStreams } = this.#monitor(toUpdate)

    // Remove unused streams
    const updatedStreams = streams.concat(newStreams)
    const removed = updatedStreams.filter((s) => !toUpdate.args.networks.includes(s.id))
    removed.forEach(({ sub }) => sub.unsubscribe())

    const updated = updatedStreams.filter((s) => !removed.includes(s))
    this.#handlers[id].streams = updated
  }

  #checkValidFilter(match: Record<string, any>) {
    try {
      ControlQuery.from(match)
    } catch (error) {
      throw new ValidationError(
        `Filter match must be a valid Mongo Query Language expression: ${(error as Error).message}`,
      )
    }
  }
}
