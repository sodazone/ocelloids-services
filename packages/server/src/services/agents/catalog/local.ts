import { NotFound } from '../../../errors.js'
import { AgentCatalogOptions } from '../../../types.js'
import { Egress } from '../../egress/index.js'
import { PublisherEvents } from '../../egress/types.js'
import { Logger, Services } from '../../index.js'
import { EgressListener, Subscription } from '../../subscriptions/types.js'
import { egressMetrics } from '../../telemetry/metrics/publisher.js'

import { InformantAgent } from '../informant/agent.js'
import { Agent, AgentCatalog, AgentId, AgentRuntimeContext } from '../types.js'
import { XcmAgent } from '../xcm/agent.js'

/**
 * A local implementation of the {@link AgentCatalog}.
 */
export class LocalAgentCatalog implements AgentCatalog {
  readonly #log: Logger
  readonly #agents: Record<AgentId, Agent>
  readonly #egress: Egress

  constructor(ctx: Services, _options: AgentCatalogOptions) {
    this.#log = ctx.log
    this.#egress = new Egress(ctx)
    this.#agents = this.#loadAgents({
      ...ctx,
      egress: this.#egress,
    })
  }

  addEgressListener(eventName: keyof PublisherEvents, listener: EgressListener): Egress {
    return this.#egress.on(eventName, listener)
  }

  removeEgressListener(eventName: keyof PublisherEvents, listener: EgressListener): Egress {
    return this.#egress.off(eventName, listener)
  }

  getAgentIds(): AgentId[] {
    return Object.keys(this.#agents)
  }

  getAgentById<A extends Agent = Agent>(agentId: AgentId): A {
    if (this.#agents[agentId]) {
      return this.#agents[agentId] as A
    }
    throw new NotFound(`Agent not found (agent=${agentId})`)
  }

  getAgentInputSchema(agentId: AgentId) {
    const agent = this.getAgentById(agentId)
    return agent.inputSchema
  }

  async startAgent(agentId: AgentId, subscriptions: Subscription[] = []) {
    const agent = this.#agents[agentId]
    this.#log.info('[catalog:local] starting agent %s (%s)', agentId, agent.metadata.name ?? 'unnamed')
    await agent.start(subscriptions)
  }

  async stop() {
    for (const [id, agent] of Object.entries(this.#agents)) {
      this.#log.info('[catalog:local] stopping agent %s', id)
      await agent.stop()
    }
  }

  collectTelemetry() {
    egressMetrics(this.#egress)

    for (const [id, agent] of Object.entries(this.#agents)) {
      this.#log.info('[catalog:local] collect telemetry from agent %s', id)
      agent.collectTelemetry()
    }
  }

  #loadAgents(ctx: AgentRuntimeContext) {
    const xcm = new XcmAgent(ctx)
    const informant = new InformantAgent(ctx)

    return {
      [xcm.id]: xcm,
      [informant.id]: informant,
    } as unknown as Record<AgentId, Agent>
  }
}
