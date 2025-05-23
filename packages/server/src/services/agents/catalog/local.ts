import { NotFound } from '@/errors.js'
import { Egress } from '@/services/egress/index.js'
import { PublisherEvents } from '@/services/egress/types.js'
import { Logger, Services } from '@/services/index.js'
import { EgressMessageListener, Subscription } from '@/services/subscriptions/types.js'
import { egressMetrics } from '@/services/telemetry/metrics/publisher.js'
import { AgentCatalogOptions } from '@/types.js'

import { InformantAgent } from '@/services/agents/informant/agent.js'
import {
  Agent,
  AgentCatalog,
  AgentId,
  AgentRuntimeContext,
  Queryable,
  Subscribable,
  isQueryable,
  isSubscribable,
} from '@/services/agents/types.js'
import { XcmAgent } from '@/services/agents/xcm/agent.js'
import { TickerAgent } from '../ticker/agent.js'
import { DataSteward } from '../steward/agent.js'
// import { ChainSpy } from '../chainspy/agent.js'

function shouldStart(agent: Agent) {
  const {
    metadata: { capabilities },
  } = agent
  return capabilities.queryable && !capabilities.subscribable
}

const registry: Record<AgentId, (ctx: AgentRuntimeContext) => Agent> = {
  xcm: (ctx) => new XcmAgent(ctx),
  informant: (ctx) => new InformantAgent(ctx),
  steward: (ctx) => new DataSteward(ctx),
  reporter: (ctx) => new TickerAgent(ctx),
  // chainspy: (ctx) => new ChainSpy(ctx),
}

/**
 * A local implementation of the {@link AgentCatalog}.
 */
export class LocalAgentCatalog implements AgentCatalog {
  readonly #log: Logger
  readonly #agents: Record<AgentId, Agent>
  readonly #egress: Egress

  constructor(ctx: Services, options: AgentCatalogOptions) {
    this.#log = ctx.log
    this.#egress = ctx.egress
    this.#agents = this.#loadAgents(
      {
        log: ctx.log,
        archive: ctx.archive,
        ingress: ctx.ingress,
        janitor: ctx.janitor,
        db: ctx.levelDB,
        scheduler: ctx.scheduler,
        egress: ctx.egress,
        agentCatalog: this,
        analyticsDB: ctx.analyticsDB,
        archiveRetention: ctx.archiveRetention,
      },
      options,
    )
  }

  addEgressListener(eventName: keyof PublisherEvents, listener: EgressMessageListener): Egress {
    return this.#egress.on(eventName, listener)
  }

  removeEgressListener(eventName: keyof PublisherEvents, listener: EgressMessageListener): Egress {
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

  getSubscribableById<A extends Agent & Subscribable = Agent & Subscribable>(agentId: AgentId): A {
    const agent = this.getAgentById(agentId)
    if (isSubscribable(agent)) {
      return agent as A
    }
    throw new NotFound(`Not subscribable (agent=${agentId})`)
  }

  getQueryableById<A extends Agent & Queryable = Agent & Queryable>(agentId: AgentId): A {
    const agent = this.getAgentById(agentId)
    if (isQueryable(agent)) {
      return agent as A
    }
    throw new NotFound(`Not queryable (agent=${agentId})`)
  }

  getAgentInputSchema(agentId: AgentId) {
    const agent = this.getSubscribableById(agentId)
    return agent.inputSchema
  }

  getAgentQuerySchema(agentId: AgentId) {
    const agent = this.getQueryableById(agentId)
    return agent.querySchema
  }

  async startAgent(agentId: AgentId, subscriptions: Subscription[] = []) {
    const agent = this.#agents[agentId]
    if (agent.metadata.capabilities.subscribable) {
      this.#log.info('[catalog:local] starting agent %s (%s)', agentId, agent.metadata.name ?? 'unnamed')
      await agent.start(subscriptions)
    }
  }

  async start() {
    for (const [id, agent] of Object.entries(this.#agents)) {
      if (shouldStart(agent)) {
        this.#log.info('[catalog:local] starting agent %s', id)
        await agent.start()
      }
    }
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

  #loadAgents(ctx: AgentRuntimeContext, opts: AgentCatalogOptions) {
    const activations: Record<AgentId, Agent> = {}

    if (opts.agents === '*') {
      for (const create of Object.values(registry)) {
        const agent = create(ctx)
        activations[agent.id] = agent
        this.#log.info('[catalog:local] activated agent %s', agent.id)
      }
    } else {
      const agentIds = opts.agents.split(',').map((x) => x.trim())
      for (const agentId of agentIds) {
        if (registry[agentId] === undefined) {
          this.#log.warn('[catalog:local] unknown agent id %s', agentId)
        } else {
          const agent = registry[agentId](ctx)
          activations[agent.id] = agent
          this.#log.info('[catalog:local] activated agent %s', agent.id)
        }
      }
    }

    return activations
  }
}
