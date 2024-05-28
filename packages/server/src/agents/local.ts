import { Logger, Services } from '../services/index.js'
import { AgentId } from '../services/monitoring/types.js'
import { AgentServiceOptions } from '../types.js'
import { Agent, AgentService } from './types.js'
import { XCMAgent } from './xcm/xcm-agent.js'

export class LocalAgentService implements AgentService {
  readonly #log: Logger
  readonly #agents: Record<AgentId, Agent>

  constructor(ctx: Services, _options: AgentServiceOptions) {
    this.#log = ctx.log
    this.#agents = this.#loadAgents(ctx)
  }

  getAgentIds(): AgentId[] {
    return Object.keys(this.#agents)
  }

  getAgentById(agentId: AgentId): Agent {
    if (this.#agents[agentId]) {
      return this.#agents[agentId]
    }
    throw new Error(`Agent not found with id=${agentId}`)
  }

  async start() {
    for (const [id, agent] of Object.entries(this.#agents)) {
      this.#log.info('[agents:local] Starting agent %s', id)
      await agent.start()
    }
  }

  async stop() {
    for (const [id, agent] of Object.entries(this.#agents)) {
      this.#log.info('[agents:local] Stopping agent %s', id)
      await agent.stop()
    }
  }

  #loadAgents(ctx: Services) {
    const xcm = new XCMAgent(ctx)
    return {
      [xcm.id]: xcm,
    }
  }
}
