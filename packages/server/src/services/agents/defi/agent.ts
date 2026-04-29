import { Logger } from '@/services/types.js'
import { DataSteward } from '../steward/agent.js'
import { TickerAgent } from '../ticker/agent.js'
import { Agent, AgentMetadata, AgentRuntimeContext, getAgentCapabilities } from '../types.js'
import { hydrationDexMonitor } from './networks/hydration/index.js'

const DEFI_AGENT_ID = 'defi'

type DefiMonitor = {
  start: () => void
  stop: () => void
}

export class DefiAgent implements Agent {
  id = DEFI_AGENT_ID
  metadata: AgentMetadata = {
    name: 'DeFi Agent',
    description: 'Indexes and tracks DeFi activity and TVL.',
    capabilities: getAgentCapabilities(this),
  }

  readonly #log: Logger
  readonly #monitors: DefiMonitor[]

  constructor(
    ctx: AgentRuntimeContext,
    deps: {
      steward: DataSteward
      ticker: TickerAgent
    },
  ) {
    const { ingress } = ctx

    this.#log = ctx.log
    this.#monitors = [hydrationDexMonitor(ingress.substrate)]
  }

  async start() {
    for (const monitor of this.#monitors) {
      monitor.start()
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
}
