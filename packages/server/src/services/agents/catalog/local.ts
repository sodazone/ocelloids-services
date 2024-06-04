import { NotFound } from '../../../errors.js'
import { AgentCatalogOptions } from '../../../types.js'
import { PublisherHub } from '../../egress/index.js'
import { PublisherEvents } from '../../egress/types.js'
import { Logger, Services } from '../../index.js'
import { PublicationListener, Subscription } from '../../subscriptions/types.js'

import { InformantAgent } from '../informant/agent.js'
import { Agent, AgentCatalog, AgentId, AgentRuntimeContext } from '../types.js'
import { XcmAgent } from '../xcm/agent.js'

/**
 * A local implementation of the {@link AgentCatalog}.
 */
export class LocalAgentCatalog implements AgentCatalog {
  readonly #log: Logger
  readonly #agents: Record<AgentId, Agent>
  readonly #notifier: PublisherHub

  constructor(ctx: Services, _options: AgentCatalogOptions) {
    this.#log = ctx.log
    this.#notifier = new PublisherHub(ctx)
    this.#agents = this.#loadAgents({
      ...ctx,
      egress: this.#notifier,
    })
  }

  addPublicationListener(eventName: keyof PublisherEvents, listener: PublicationListener): PublisherHub {
    return this.#notifier.on(eventName, listener)
  }

  removePublicationListener(eventName: keyof PublisherEvents, listener: PublicationListener): PublisherHub {
    return this.#notifier.off(eventName, listener)
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
