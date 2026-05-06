import { Operation } from 'rfc6902'
import { AccountWithCaps } from '@/services/accounts/types.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { Logger } from '@/services/types.js'
import { DataSteward } from '../steward/agent.js'
import { TickerAgent } from '../ticker/agent.js'
import { Agent, AgentMetadata, AgentRuntimeContext, getAgentCapabilities, Subscribable } from '../types.js'
import { hydrationDexMonitor } from './networks/hydration/index.js'
import { $DefiAgentInputs, DefiAgentInputs } from './types.js'

const DEFI_AGENT_ID = 'defi'

type DefiMonitor = {
  start: () => Promise<void> | void
  stop: () => void
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
  readonly #monitors: DefiMonitor[]

  readonly inputSchema = $DefiAgentInputs

  constructor(
    ctx: AgentRuntimeContext,
    deps: {
      steward: DataSteward
      ticker: TickerAgent
    },
  ) {
    const { ingress } = ctx

    this.#log = ctx.log
    this.#monitors = [hydrationDexMonitor(ingress, deps.steward)]
  }

  async start() {
    for (const monitor of this.#monitors) {
      await monitor.start()
    }
  }

  stop() {
    for (const monitor of this.#monitors) {
      monitor.stop()
    }
  }

  collectTelemetry() {
    // TODO
  }

  subscribe(subscription: Subscription<DefiAgentInputs>, account?: AccountWithCaps): Promise<void> | void {
    const { args } = subscription
    if (args.topic === 'liquidity') {
      //
    } else {
      //
    }
  }

  unsubscribe(subscriptionId: string): Promise<void> | void {
    //
  }

  update(subscriptionId: string, patch: Operation[]): Promise<Subscription> | Subscription {
    throw new Error('Update not supported')
  }
}
