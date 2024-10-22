import { Operation } from 'rfc6902'
import { z } from 'zod'

import { filter as rxFilter } from 'rxjs'

import { ControlQuery, asSerializable } from '@/common/index.js'
import { ValidationError } from '@/errors.js'
import { Egress } from '@/services/egress/hub.js'
import { RxSubscriptionWithId, Subscription } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN } from '@/services/types.js'

import { SharedStreams } from '../base/shared.js'
import { SubscriptionUpdater, hasOp } from '../base/updater.js'

import { Agent, AgentMetadata, AgentRuntimeContext, Subscribable, getAgentCapabilities } from '../types.js'

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
    match: z.record(z.any()),
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
  readonly #shared: SharedStreams
  readonly #handlers: Record<string, InformantHandler>
  readonly #egress: Egress
  readonly #updater: SubscriptionUpdater

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log
    this.#shared = SharedStreams.instance(ctx.ingress)
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
      id,
      args: { networks, filter },
    } = subscription

    const streams: RxSubscriptionWithId[] = []
    const control = ControlQuery.from(filter.match)

    try {
      for (const network of networks) {
        const chainId = network as NetworkURN

        if (filter.type === 'extrinsic') {
          streams.push({
            chainId,
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
                        events: extrinsic.events.map((e) => asSerializable(e)),
                        dispatchInfo: asSerializable(extrinsic.dispatchInfo),
                        dispatchError: asSerializable(extrinsic.dispatchError),
                        extrinsic: asSerializable(extrinsic),
                      },
                    })
                  } catch (error) {
                    this.#log.error(error, '[%s:%s] error on notify extrinsic (%s)', this.id, chainId, id)
                  }
                },
              }),
          })
        } else {
          streams.push({
            chainId,
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
          })
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

  async #updateNetworks(toUpdate: Subscription<InformantInputs>) {
    const { id } = toUpdate

    // Subscribe to new if any
    const { streams } = this.#handlers[id]
    const { streams: newStreams } = await this.#monitor(toUpdate)

    // Remove unused streams
    const updatedStreams = streams.concat(newStreams)
    const removed = updatedStreams.filter((s) => !toUpdate.args.networks.includes(s.chainId))
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
