import { AgentService } from '../../agents/types.js'
import { NotFound, ValidationError } from '../../errors.js'
import { AgentId, Subscription } from '../monitoring/types.js'
import { DB, Logger, NetworkURN, jsonEncoded, prefixes } from '../types.js'

/**
 * Subscriptions persistence.
 *
 * A subscription is expected to have a unique id in the database.
 */
export class SubsStore {
  // readonly #log: Logger;
  readonly #db: DB
  readonly #agentService: AgentService

  constructor(_log: Logger, db: DB, agentService: AgentService) {
    // this.#log = log;
    this.#db = db
    this.#agentService = agentService
  }

  /**
   * Returns true if a subscription for the given id exists,
   * false otherwise.
   */
  async exists(id: string): Promise<boolean> {
    try {
      await this.getById(id)
      return true
    } catch {
      return false
    }
  }

  /**
   * Retrieves the registered subscriptions in the database
   * for all the configured networks.
   *
   * @returns {Subscription[]} an array with the subscriptions
   */
  async getAll() {
    let subscriptions: Subscription[] = []
    for (const chainId of this.#agentService.getAgentIds()) {
      const subs = await this.getByAgentId(chainId)
      subscriptions = subscriptions.concat(subs)
    }

    return subscriptions
  }

  /**
   * Retrieves all the subscriptions for a given agent.
   *
   * @returns {Subscription[]} an array with the subscriptions
   */
  async getByAgentId(agentId: AgentId) {
    return await this.#subsFamily(agentId).values().all()
  }

  /**
   * Retrieves a subscription by identifier.
   *
   * @param {string} id The subscription identifier
   * @returns {Subscription} the subscription information
   * @throws {NotFound} if the subscription does not exist
   */
  async getById(id: string) {
    for (const agentId of this.#agentService.getAgentIds()) {
      try {
        const subscription = await this.#subsFamily(agentId).get(id)
        return subscription
      } catch {
        continue
      }
    }

    throw new NotFound(`Subscription ${id} not found.`)
  }

  /**
   * Inserts a new subscription.
   *
   * @throws {ValidationError} if there is a validation error.
   */
  async insert(s: Subscription) {
    if (await this.exists(s.id)) {
      throw new ValidationError(`Subscription with ID ${s.id} already exists`)
    }
    await this.save(s)
  }

  /**
   * Updates the subscription data.
   *
   * @throws {ValidationError} if there is a validation error.
   */
  async save(s: Subscription) {
    const db = await this.#subsFamily(s.agent)
    await db.put(s.id, s)
  }

  /**
   * Removes a subscription for the given id.
   */
  async remove(id: string) {
    const s = await this.getById(id)
    await this.#subsFamily(s.agent).del(id)
  }

  #subsFamily(agentId: AgentId) {
    return this.#db.sublevel<string, Subscription>(prefixes.subs.family(agentId), jsonEncoded)
  }
}
