import { NotFound } from '@/errors.js'
import { InformantAgent } from '@/services/agents/informant/agent.js'
import {
  Agent,
  AgentCatalog,
  AgentId,
  AgentRuntimeContext,
  isQueryable,
  isStreamable,
  isSubscribable,
  Queryable,
  Streamable,
  Subscribable,
} from '@/services/agents/types.js'
import { XcmAgent } from '@/services/agents/xcm/agent.js'
import { Egress } from '@/services/egress/index.js'
import { PublisherEvents } from '@/services/egress/types.js'
import { Logger, Services } from '@/services/index.js'
import { EgressMessageListener, Subscription } from '@/services/subscriptions/types.js'
import { egressMetrics } from '@/services/telemetry/metrics/publisher.js'
import { PullCollector } from '@/services/telemetry/types.js'
import { AgentCatalogOptions, DatabaseOptions } from '@/types.js'
import { ChainSpy } from '../chainspy/agent.js'
import { CrosschainExplorer } from '../crosschain/explorer.js'
import { HyperbridgeAgent } from '../hyperbridge/agent.js'
import { DataSteward } from '../steward/agent.js'
import { TickerAgent } from '../ticker/agent.js'
import { WormholeAgent } from '../wormhole/agent.js'

const DIRTY_TOGGLES = {
  chainspy: process.env.ENABLE_CHAINSPY === 'true',
  crosschain: process.env.ENABLE_CROSSCHAIN !== 'false',
}

function shouldStart(agent: Agent) {
  const {
    metadata: { capabilities, runInBackground },
  } = agent
  return runInBackground || (capabilities.queryable && !capabilities.subscribable)
}

const registry: Record<AgentId, (ctx: AgentRuntimeContext, activations: Record<AgentId, Agent>) => Agent> = {
  informant: (ctx) => new InformantAgent(ctx),
  steward: (ctx) => new DataSteward(ctx),
  ticker: (ctx) => new TickerAgent(ctx),
  ...(DIRTY_TOGGLES['crosschain'] && {
    crosschain: (ctx) => new CrosschainExplorer(ctx),
  }),
  wormhole: (ctx, activations) =>
    new WormholeAgent(ctx, {
      steward: activations['steward'] as DataSteward,
      crosschain: activations['crosschain'] as CrosschainExplorer,
    }),
  hyperbridge: (ctx, activations) =>
    new HyperbridgeAgent(ctx, {
      steward: activations['steward'] as DataSteward,
      ticker: activations['ticker'] as TickerAgent,
      crosschain: activations['crosschain'] as CrosschainExplorer,
    }),
  xcm: (ctx, activations) =>
    new XcmAgent(ctx, {
      steward: activations['steward'] as DataSteward,
      ticker: activations['ticker'] as TickerAgent,
      crosschain: activations['crosschain'] as CrosschainExplorer,
    }),
  ...(DIRTY_TOGGLES['chainspy'] && {
    chainspy: (ctx) => new ChainSpy(ctx),
  }),
}

/**
 * A local implementation of the {@link AgentCatalog}.
 */
export class LocalAgentCatalog implements AgentCatalog {
  readonly #log: Logger
  readonly #agents: Record<AgentId, Agent>
  readonly #egress: Egress

  constructor(ctx: Services, options: AgentCatalogOptions & DatabaseOptions) {
    this.#log = ctx.log
    this.#egress = ctx.egress
    this.#agents = this.#loadAgents(
      {
        log: ctx.log,
        archive: ctx.archive,
        ingress: ctx.ingress,
        janitor: ctx.janitor,
        db: ctx.levelDB,
        openLevelDB: ctx.openLevelDB,
        scheduler: ctx.scheduler,
        egress: ctx.egress,
        agentCatalog: this,
        analyticsDB: ctx.analyticsDB,
        archiveRetention: ctx.archiveRetention,
        environment: {
          dataPath: options.data,
        },
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

  getStreamableById<A extends Agent & Streamable = Agent & Streamable>(agentId: AgentId): A {
    const agent = this.getAgentById(agentId)
    if (isStreamable(agent)) {
      return agent as A
    }
    throw new NotFound(`Not streamable (agent=${agentId})`)
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

    const collectors: PullCollector[] = []
    for (const [id, agent] of Object.entries(this.#agents)) {
      this.#log.info('[catalog:local] collect telemetry from agent %s', id)
      const c = agent.collectTelemetry()
      if (c && c.length > 0) {
        collectors.push(...c)
      }
    }
    return collectors
  }

  // TODO: consider dependencies to make it instantiation order independent
  #loadAgents(ctx: AgentRuntimeContext, opts: AgentCatalogOptions) {
    const activations: Record<AgentId, Agent> = {}

    const requested =
      opts.agents === '*' ? Object.keys(registry) : opts.agents.split(',').map((id) => id.trim())

    for (const agentId of requested) {
      const create = registry[agentId]
      if (!create) {
        this.#log.warn('[catalog:local] unknown agent id %s', agentId)
        continue
      }

      const config = opts.agentConfigs?.[agentId] ?? {}
      const agent = create({ ...ctx, config }, activations)
      activations[agent.id] = agent
      this.#log.info('[catalog:local] activated agent %s', agent.id)
    }

    return activations
  }
}
