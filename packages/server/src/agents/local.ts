import { Logger, Services } from '../services/index.js'
import { AgentId } from '../services/monitoring/types.js'
import { AgentServiceOptions } from '../types.js'
import { Agent, AgentService } from './types.js'
import { XCMAgent } from './xcm/xcm-agent.js'

/**
 * Local agent service.
 */
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
    throw new Error(`Agent not found for id=${agentId}`)
  }

  getAgentInputSchema(agentId: AgentId) {
    const agent = this.getAgentById(agentId)
    return agent.getInputSchema()
  }

  async start() {
    for (const [id, agent] of Object.entries(this.#agents)) {
      this.#log.info('[local:agents] Starting agent %s', id)
      await agent.start()
    }
  }

  async stop() {
    for (const [id, agent] of Object.entries(this.#agents)) {
      this.#log.info('[local:agents] Stopping agent %s', id)
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
