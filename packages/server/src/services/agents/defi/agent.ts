import { Operation } from 'rfc6902'
import { filter, map, merge, Observable, Subscription as RxSubscription } from 'rxjs'

import { Egress } from '@/services/egress/index.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { DataSteward } from '../steward/agent.js'
import { TickerAgent } from '../ticker/agent.js'
import { Agent, AgentMetadata, AgentRuntimeContext, getAgentCapabilities, Subscribable } from '../types.js'
import { hydrationDexMonitor } from './networks/hydration/index.js'
import { moonbeamDexMonitor } from './networks/moonbeam/monitor.js'
import { $DefiAgentInputs, DefiAgentInputs, DefiSubscriptionPayload } from './types.js'

const DEFI_AGENT_ID = 'defi'

type DefiMonitor = {
  start: () => Promise<void> | void
  stop: () => void
  chainId: NetworkURN
  events$: Observable<DefiSubscriptionPayload>
}

type SubscriptionHandler = {
  subscription: Subscription<DefiAgentInputs>
  stream: RxSubscription
}

type DefiAgentDependencies = {
  steward: DataSteward
  ticker: TickerAgent
}

export class DefiAgent implements Agent, Subscribable {
  id = DEFI_AGENT_ID
  metadata: AgentMetadata = {
    name: 'DeFi Agent',
    description: 'Indexes and tracks DeFi activity and liquidity.',
    capabilities: getAgentCapabilities(this),
    runInBackground: true,
  }

  readonly #log: Logger

  readonly #ingress: IngressConsumers
  readonly #notifier: Egress
  readonly #dependencies: DefiAgentDependencies

  readonly #monitors: DefiMonitor[]
  readonly #subs: Map<string, SubscriptionHandler> = new Map()

  readonly inputSchema = $DefiAgentInputs

  constructor(ctx: AgentRuntimeContext, deps: DefiAgentDependencies) {
    const { ingress, egress } = ctx

    this.#log = ctx.log
    this.#ingress = ingress
    this.#notifier = egress
    this.#dependencies = deps
    this.#monitors = []
  }

  async start(subs?: Subscription<DefiAgentInputs>[]) {
    // TODO: check networks before creating the monitors, if(ingress.substrate.isNetworkDefined())
    this.#monitors.push(
      hydrationDexMonitor(this.#ingress, this.#dependencies.steward),
      moonbeamDexMonitor(this.#ingress.evm),
    )

    for (const monitor of this.#monitors) {
      await monitor.start()
    }

    if (subs !== undefined && subs.length > 0) {
      this.#log.info('[agent:%s] creating stored subscriptions (%d)', this.id, subs.length)

      for (const sub of subs) {
        try {
          this.subscribe(sub)
        } catch (error) {
          this.#log.error(error, '[agent:%s] unable to create subscription: %j', this.id, sub)
        }
      }
    }
    this.#log.info('[agent:%s] started', this.id)
  }

  stop() {
    for (const handler of this.#subs.values()) {
      handler.stream.unsubscribe()
    }

    for (const monitor of this.#monitors) {
      monitor.stop()
    }

    this.#log.info('[agent:%s] stopped', this.id)
  }

  collectTelemetry() {
    // TODO
  }

  subscribe(subscription: Subscription<DefiAgentInputs>) {
    const { id, args } = subscription

    const selectedMonitors =
      args.networks === '*' ? this.#monitors : this.#monitors.filter((m) => args.networks.includes(m.chainId))

    const combinedStream$ = merge(
      ...selectedMonitors.map((monitor) =>
        monitor.events$.pipe(
          filter((payload) => payload.type === args.topic),
          filter((payload) => {
            if (payload.type === 'liquidity') {
              // TODO: liquidity filters
            }

            if (payload.type === 'event') {
              // TODO: event filters
            }

            return true
          }),

          map((payload) => ({ payload, chainId: monitor.chainId })),
        ),
      ),
    )

    const stream = combinedStream$.subscribe({
      next: ({ payload, chainId }) => {
        this.#notifier.publish(subscription, {
          metadata: {
            type: 'defi',
            subscriptionId: id,
            agentId: this.id,
            networkId: chainId,
            timestamp: Date.now(),
          },
          payload,
        })
      },
      error: (err) => this.#log.error(err, '[agent:%s] stream error for sub %s', this.id, id),
    })

    this.#subs.set(id, { subscription, stream })
  }

  unsubscribe(subscriptionId: string) {
    try {
      const handler = this.#subs.get(subscriptionId)
      if (!handler) {
        this.#log.warn('[agent:%s] unsubscribe from a non-existent subscription %s', this.id, subscriptionId)
        return
      }
      handler.stream.unsubscribe()
      this.#subs.delete(subscriptionId)
    } catch (error) {
      this.#log.error(error, '[agent:%s] error unsubscribing %s', this.id, subscriptionId)
    }
  }

  update(subscriptionId: string, patch: Operation[]): Promise<Subscription> | Subscription {
    throw new Error('Update not supported')
  }
}
