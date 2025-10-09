import { NotFound, ValidationError } from '@/errors.js'
import { AgentId } from '@/services/agents/types.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { jsonEncoded, LevelDB, Logger, prefixes } from '@/services/types.js'

/**
 * Subscriptions persistence.
 *
 * A subscription is expected to have a unique id in the database.
 */
export class SubsStore {
  // readonly #log: Logger;
  readonly #db: LevelDB

  constructor(_log: Logger, db: LevelDB) {
    // this.#log = log;
    this.#db = db
  }

  /**
   * Returns true if a subscription for the given id exists,
   * false otherwise.
   */
  async exists(agentId: AgentId, id: string): Promise<boolean> {
    try {
      await this.getById(agentId, id)
      return true
    } catch {
      return false
    }
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
   * Retrieves a subscription by ID.
   *
   * @param {string} subscriptionId - The subscription ID
   * @returns {Subscription} the subscription
   * @throws {NotFound} if the subscription does not exist
   */
  async getById(agentId: AgentId, subscriptionId: string) {
    const subscription = await this.#subsFamily(agentId).get(subscriptionId)
    if (subscription === undefined) {
      throw new NotFound(`Subscription ${agentId} ${subscriptionId} not found.`)
    }
    return subscription
  }

  /**
   * Inserts a new subscription.
   *
   * @throws {ValidationError} if there is a validation error.
   */
  async insert(s: Subscription) {
    if (await this.exists(s.agent, s.id)) {
      throw new ValidationError(`Subscription with ID=${s.agent}:${s.id} already exists`)
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
  async remove(agentId: AgentId, id: string) {
    await this.#subsFamily(agentId).del(id)
  }

  #subsFamily(agentId: AgentId) {
    return this.#db.sublevel<string, Subscription>(prefixes.subs.family(agentId), jsonEncoded)
  }
}
