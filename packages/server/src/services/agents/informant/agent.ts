import { ControlQuery, mongoFilter } from '@sodazone/ocelloids-sdk'
import { Operation } from 'rfc6902'
import { z } from 'zod'

import { ValidationError } from '../../../errors.js'
import { Egress } from '../../../services/egress/hub.js'
import { RxSubscriptionWithId, Subscription } from '../../subscriptions/types.js'
import { Logger, NetworkURN } from '../../types.js'

import { SharedStreams } from '../base/shared.js'
import { Agent, AgentMetadata, AgentRuntimeContext } from '../types.js'

export const $InformantInputs = z.object({
  networks: z.array(
    z
      .string({
        required_error: 'Network URNs are required, e.g. "urn:ocn:polkadot:0"',
      })
      .min(1)
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
export class InformantAgent implements Agent {
  readonly #log: Logger
  readonly #shared: SharedStreams
  readonly #handlers: Record<string, InformantHandler>
  readonly #egress: Egress

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log
    this.#shared = new SharedStreams(ctx.ingress)
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
    }
  }

  get inputSchema(): z.ZodSchema {
    return $InformantInputs
  }

  async subscribe(subscription: Subscription<InformantInputs>): Promise<void> {
    this.#checkValidFilter(subscription.args)

    const handler = await this.#monitor(subscription)

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

  update(_subscriptionId: string, _patch: Operation[]): Promise<Subscription> {
    throw new Error('Method not implemented.')
  }

  stop() {
    for (const handler of Object.values(this.#handlers)) {
      this.#log.info('[%s] unsubscribe %s', this.id, handler.subscription.id)
      handler.streams.forEach(({ sub }) => {
        sub.unsubscribe()
      })
    }
  }

  async start(subscriptions: Subscription<InformantInputs>[]): Promise<void> {
    this.#log.info('[%s] start subscriptions %d', this.id, subscriptions.length)

    for (const sub of subscriptions) {
      try {
        this.#handlers[sub.id] = await this.#monitor(sub)
      } catch (err) {
        this.#log.error(err, '[%s] unable to create subscription: %j', this.id, sub)
      }
    }
  }

  collectTelemetry(): void {
    //
  }

  async #monitor(subscription: Subscription<InformantInputs>): Promise<InformantHandler> {
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
              .pipe(mongoFilter(control))
              .subscribe({
                error: (error: any) => {
                  this.#log.error(error, '[%s:%s] error on network subscription %s', this.id, chainId, id)
                },
                next: (msg) => {
                  try {
                    this.#egress.publish(subscription, {
                      metadata: {
                        type: 'extrinsic',
                        subscriptionId: id,
                        agentId: this.id,
                        networkId: chainId,
                        timestamp: Date.now(),
                      },
                      payload: {
                        events: msg.events.map((e) => e.toHuman()),
                        levelId: msg.levelId,
                        dispatchInfo: msg.dispatchInfo?.toHuman(),
                        dispatchError: msg.dispatchError?.toHuman(),
                        extrinsic: msg.extrinsic.toHuman(),
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
              .pipe(mongoFilter(control))
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
                      },
                      payload: msg.toHuman(),
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

  #checkValidFilter(args: InformantInputs) {
    try {
      // TODO implement a proper validation
      JSON.stringify(args.filter.match)
    } catch {
      throw new ValidationError('Filter match must be a valid JSON object')
    }
  }
}
