import { z } from 'zod'
import { asSerializable } from '@/common/index.js'
import { ValidationError } from '@/errors.js'
import { Egress } from '@/services/egress/index.js'
import { getTimestampFromBlock } from '@/services/networking/substrate/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { RxSubscriptionWithId, Subscription } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { Agent, AgentMetadata, AgentRuntimeContext, getAgentCapabilities, Subscribable } from '../types.js'

export const $ChainSpyInputs = z.object({
  networks: z.array(
    z
      .string({
        required_error: 'Network URNs are required, e.g. "urn:ocn:polkadot:0"',
      })
      .min(1),
  ),
})

export type ChainSpyInputs = z.infer<typeof $ChainSpyInputs>

export class ChainSpy implements Agent, Subscribable {
  readonly id = 'chainspy'
  readonly metadata: AgentMetadata = {
    name: this.id,
    capabilities: getAgentCapabilities(this),
  }

  readonly inputSchema = $ChainSpyInputs

  readonly #handlers: Record<
    string,
    {
      subscription: Subscription<ChainSpyInputs>
      streams: RxSubscriptionWithId[]
    }
  >
  readonly #shared: SubstrateSharedStreams
  readonly #log: Logger
  readonly #egress: Egress

  constructor(ctx: AgentRuntimeContext) {
    this.#log = ctx.log
    this.#shared = SubstrateSharedStreams.instance(ctx.ingress.substrate)
    this.#egress = ctx.egress
    this.#handlers = {}
  }

  subscribe(subscription: Subscription<ChainSpyInputs>) {
    if (subscription.ephemeral) {
      const {
        id,
        args: { networks },
      } = subscription

      const streams: RxSubscriptionWithId[] = []

      try {
        for (const network of networks) {
          const chainId = network as NetworkURN

          this.#shared.checkSupportedNetwork(chainId)
          const stream = this.#shared.blocks(chainId, 'new').subscribe({
            error: (error: any) => {
              this.#log.error(error, '[%s:%s] error on network subscription %s', this.id, chainId, id)
            },
            next: (block) => {
              try {
                const blockTimestamp = getTimestampFromBlock(block.extrinsics)
                this.#egress.publish(subscription, {
                  metadata: {
                    type: 'new-block',
                    subscriptionId: id,
                    agentId: this.id,
                    networkId: chainId,
                    timestamp: Date.now(),
                    blockTimestamp,
                  },
                  payload: asSerializable(block),
                })
              } catch (error) {
                this.#log.error(error, '[%s:%s] error on notify new block (%s)', this.id, chainId, id)
              }
            },
          })

          streams.push({
            id: chainId,
            sub: stream,
          })
        }
      } catch (error) {
        // clean up
        streams.forEach(({ sub }) => {
          sub.unsubscribe()
        })
        throw error
      }

      this.#handlers[subscription.id] = {
        subscription,
        streams,
      }
    } else {
      throw new ValidationError('Persistent subscription are not supported')
    }
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

  update(): Subscription {
    throw new Error('Update is not supported')
  }

  stop() {
    for (const handler of Object.values(this.#handlers)) {
      this.#log.info('[agent:%s] unsubscribe %s', this.id, handler.subscription.id)
      handler.streams.forEach(({ sub }) => {
        sub.unsubscribe()
      })
    }
  }

  collectTelemetry() {
    //
  }

  start() {
    this.#log.info('[%s] start', this.id)
  }
}
