import { Operation } from 'rfc6902'
import { filter } from 'rxjs'
import { asSerializable, ControlQuery, Criteria } from '@/common/index.js'
import { Egress } from '@/services/egress/index.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { AnyJson, Logger, NetworkURN } from '@/services/types.js'
import { DataSteward } from '../steward/agent.js'
import { TickerAgent } from '../ticker/agent.js'
import { Agent, AgentMetadata, AgentRuntimeContext, getAgentCapabilities, Subscribable } from '../types.js'
import { TransfersTracker } from './tracker.js'
import {
  $TransfersAgentInputs,
  EnrichedTransfer,
  TransfersAgentInputs,
  TransfersSubscriptionHandler,
} from './type.js'

const TRANSFERS_AGENT_ID = 'transfers'

export class TransfersAgent implements Agent, Subscribable {
  id = TRANSFERS_AGENT_ID
  metadata: AgentMetadata = {
    name: 'Transfers Agent',
    description: 'Indexes and tracks intra-chain transfers.',
    capabilities: getAgentCapabilities(this),
  }

  readonly inputSchema = $TransfersAgentInputs
  readonly #log: Logger
  readonly #notifier: Egress

  readonly #tracker: TransfersTracker
  readonly #subs: Map<string, TransfersSubscriptionHandler> = new Map()

  constructor(
    ctx: AgentRuntimeContext,
    deps: {
      steward: DataSteward
      ticker: TickerAgent
    },
  ) {
    const { ingress } = ctx

    this.#log = ctx.log
    this.#notifier = ctx.egress
    this.#tracker = new TransfersTracker({
      log: ctx.log,
      ingress: ingress.substrate,
      steward: deps.steward,
      ticker: deps.ticker,
    })

    this.#log.info('[agent:%s] created ', this.id)
  }

  async start() {
    await this.#tracker.start()
    this.#log.info('[agent:%s] started', this.id)
  }

  stop() {
    this.#tracker.stop()
    this.#log.info('[agent:%s] stopped', this.id)
  }

  collectTelemetry() {
    //
  }

  subscribe(subscription: Subscription<TransfersAgentInputs>) {
    const { id, args } = subscription

    this.#validateNetworks(args)
    const networksControl = ControlQuery.from(this.#networkCriteria(args.networks))
    const stream = this.#tracker.transfers$
      .pipe(filter((transfer) => networksControl.value.test(transfer)))
      .subscribe({
        next: (payload: EnrichedTransfer) => {
          if (this.#subs.has(id)) {
            const handler = this.#subs.get(id)
            if (!handler) {
              this.#log.error(`No subscription handler found for subscription ID ${id}`)
              return
            }
            this.#notifier.publish(handler.subscription, {
              metadata: {
                type: 'transfers',
                subscriptionId: id,
                agentId: this.id,
                networkId: payload.chainId,
                timestamp: Date.now(),
                blockTimestamp: payload.timestamp,
              },
              payload: asSerializable(payload) as unknown as AnyJson,
            })
          } else {
            // this could happen with closed ephemeral subscriptions
            this.#log.warn('[agent:%s] unable to find descriptor for subscription %s', this.id, id)
          }
        },
        complete: () => {
          if (this.#subs.has(id)) {
            const handler = this.#subs.get(id)
            if (!handler) {
              this.#log.error(`No subscription handler found for subscription ID ${id}`)
              return
            }
            if (handler.subscription.ephemeral) {
              this.#notifier.terminate(handler.subscription)
            }
          }
        },
      })

    this.#subs.set(id, {
      networksControl,
      subscription,
      stream,
    })
  }

  unsubscribe(id: string) {
    try {
      const handler = this.#subs.get(id)
      if (!handler) {
        this.#log.warn('[agent:%s] unsubscribe from a non-existent subscription %s', this.id, id)
        return
      }
      handler.stream.unsubscribe()
      this.#subs.delete(id)
    } catch (error) {
      this.#log.error(error, '[agent:%s] error unsubscribing %s', this.id, id)
    }
  }

  update(subscriptionId: string, patch: Operation[]): Subscription {
    throw new Error('Update not supported')
  }

  #validateNetworks({ networks }: TransfersAgentInputs) {
    if (networks !== '*') {
      this.#tracker.validateNetworks(networks as NetworkURN[])
    }
  }

  #networkCriteria(chainIds: string[] | '*'): Criteria {
    if (chainIds === '*') {
      return {}
    }

    return {
      chainId: { $in: chainIds },
    }
  }
}
