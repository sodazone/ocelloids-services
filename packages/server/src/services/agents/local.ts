import { NotFound } from '../../errors.js'
import { AgentServiceOptions } from '../../types.js'
import { Logger, Services } from '../index.js'
import { NotifierHub } from '../notification/index.js'
import { NotifierEvents } from '../notification/types.js'
import { NotificationListener, Subscription } from '../subscriptions/types.js'
import { TelemetryCollect } from '../telemetry/types.js'
import { Agent, AgentId, AgentRuntimeContext, AgentService } from './types.js'
import { XCMAgent } from './xcm/xcm-agent.js'

/**
 * Local agent service.
 */
export class LocalAgentService implements AgentService {
  readonly #log: Logger
  readonly #agents: Record<AgentId, Agent>
  readonly #notifier: NotifierHub

  constructor(ctx: Services, _options: AgentServiceOptions) {
    this.#log = ctx.log
    this.#notifier = new NotifierHub(ctx)
    this.#agents = this.#loadAgents({
      ...ctx,
      notifier: this.#notifier,
    })
  }

  /**
   * Retrieves the registered subscriptions in the database
   * for all the configured networks.
   *
   * @returns {Subscription[]} an array with the subscriptions
   */
  async getAllSubscriptions() {
    let subscriptions: Subscription[] = []
    for (const chainId of this.getAgentIds()) {
      const agent = await this.getAgentById(chainId)
      subscriptions = subscriptions.concat(await agent.getAllSubscriptions())
    }

    return subscriptions
  }

  addNotificationListener(eventName: keyof NotifierEvents, listener: NotificationListener): NotifierHub {
    return this.#notifier.on(eventName, listener)
  }

  removeNotificationListener(eventName: keyof NotifierEvents, listener: NotificationListener): NotifierHub {
    return this.#notifier.off(eventName, listener)
  }

  getAgentIds(): AgentId[] {
    return Object.keys(this.#agents)
  }

  getAgentById(agentId: AgentId): Agent {
    if (this.#agents[agentId]) {
      return this.#agents[agentId]
    }
    throw new NotFound(`Agent not found for id=${agentId}`)
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

  /**
   * Calls the given collect function for each private observable component.
   *
   * @param collect The collect callback function.
   */
  collectTelemetry() {
    for (const [id, agent] of Object.entries(this.#agents)) {
      this.#log.info('[local:agents] collect telemetry from agent %s', id)
      agent.collectTelemetry()
    }
  }

  #loadAgents(ctx: AgentRuntimeContext) {
    const xcm = new XCMAgent(ctx)
    return {
      [xcm.id]: xcm,
    }
  }
}
