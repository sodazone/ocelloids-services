import { ControlQuery } from '@sodazone/ocelloids-sdk'
import { Operation } from 'rfc6902'
import { filter as rxFilter } from 'rxjs'
import { z } from 'zod'

import { ValidationError } from '../../../errors.js'
import { NotifierHub } from '../../../services/notification/hub.js'
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
    match: z.string({
      required_error: 'MongoQL matching expression is required',
    }),
  }),
})

export type InformantHandler = {
  subs: RxSubscriptionWithId[]
  control: ControlQuery
  descriptor: Subscription
  args: InformantInputs
}

export type InformantInputs = z.infer<typeof $InformantInputs>

export class InformantAgent implements Agent {
  readonly #log: Logger
  readonly #shared: SharedStreams
  readonly #handlers: Record<string, InformantHandler>
  readonly #notifier: NotifierHub

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log
    this.#shared = new SharedStreams(ctx.ingressConsumer)
    this.#notifier = ctx.notifier
    this.#handlers = {}
  }

  get id(): string {
    return this.metadata.id
  }

  get metadata(): AgentMetadata {
    return {
      id: 'informant',
      name: 'General Informant',
      description: 'Fetches transactions and events using custom MongoQL-compatible filtering expressions.',
    }
  }

  get inputSchema(): z.ZodSchema {
    return $InformantInputs
  }

  async subscribe(subscription: Subscription): Promise<void> {
    const args = this.inputSchema.parse(subscription.args) as InformantInputs

    this.#checkValidFilter(args)

    const handler = await this.#monitor(subscription, args)

    this.#handlers[subscription.id] = handler
  }

  unsubscribe(subscriptionId: string) {
    const handler = this.#handlers[subscriptionId]
    if (handler) {
      handler.subs.forEach(({ sub }) => {
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
      this.#log.info('[%s] unsubscribe %s', this.id, handler.descriptor.id)
      handler.subs.forEach(({ sub }) => {
        sub.unsubscribe()
      })
    }
  }

  async start(subscriptions: Subscription[]): Promise<void> {
    this.#log.info('[%s] start subscriptions %d', this.id, subscriptions.length)

    for (const sub of subscriptions) {
      try {
        this.#handlers[sub.id] = await this.#monitor(sub, this.inputSchema.parse(sub.args))
      } catch (err) {
        this.#log.error(err, '[%s] unable to create subscription: %j', this.id, sub)
      }
    }
  }

  collectTelemetry(): void {
    //
  }

  async #monitor(descriptor: Subscription, args: InformantInputs): Promise<InformantHandler> {
    const { id } = descriptor
    const { networks, filter } = args

    const subs: RxSubscriptionWithId[] = []
    const control = ControlQuery.from(JSON.parse(filter.match))

    try {
      for (const network of networks) {
        const chainId = network as NetworkURN
        if (filter.type === 'extrinsic') {
          subs.push({
            chainId,
            sub: this.#shared
              .blockExtrinsics(chainId)
              .pipe(
                rxFilter((tx) => {
                  return control.getValue().test(tx)
                })
              )
              .subscribe({
                error: (error: any) => {
                  this.#log.error(error, '[%s:%s] error on network subscription %s', this.id, chainId, id)
                },
                next: (msg) => {
                  try {
                    this.#notifier.notify(descriptor, {
                      metadata: {
                        type: 'extrinsic',
                        subscriptionId: id,
                        agentId: this.id,
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
          console.log(control.getValue())
          subs.push({
            chainId,
            sub: this.#shared
              .blockEvents(chainId)
              .pipe(
                rxFilter((event) => {
                  return control.getValue().test(event)
                })
              )
              .subscribe({
                error: (error: any) => {
                  this.#log.error(error, '[%s:%s] error on network subscription %s', this.id, chainId, id)
                },
                next: (msg) => {
                  try {
                    this.#notifier.notify(descriptor, {
                      metadata: {
                        type: 'event',
                        subscriptionId: id,
                        agentId: this.id,
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
        args,
        descriptor,
        subs,
        control,
      }
    } catch (error) {
      // clean up
      subs.forEach(({ sub }) => {
        sub.unsubscribe()
      })
      throw error
    }
  }

  #checkValidFilter(args: InformantInputs) {
    try {
      JSON.parse(args.filter.match)
    } catch {
      throw new ValidationError('Filter match must be a valid JSON object')
    }
  }
}
