import EventEmitter from 'node:events'

import { Operation } from 'rfc6902'

import { Logger, Services } from '@/services/types.js'

import { NotFound } from '@/errors.js'
import { AgentCatalog, AgentId } from '@/services/agents/types.js'
import { PublisherEvents } from '@/services/egress/types.js'
import { SubsStore } from '@/services/persistence/level/index.js'
import { TelemetryCollect, TelemetryEventEmitter } from '@/services/telemetry/types.js'

import {
  EgressListener,
  NewSubscription,
  PublicSubscription,
  Subscription,
  SubscriptionStats,
} from './types.js'

/**
 * Custom error class for subscription-related errors.
 */
export class SubscribeError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)

    this.statusCode = statusCode
  }
}

export type SwitchboardOptions = {
  subscriptionMaxPersistent?: number
  subscriptionMaxEphemeral?: number
}

/**
 * Subscriptions Switchboard.
 *
 * Manages subscriptions and notifications for the platform agents.
 */
export class Switchboard extends (EventEmitter as new () => TelemetryEventEmitter) {
  readonly #log: Logger
  readonly #stats: SubscriptionStats
  readonly #maxEphemeral: number
  readonly #maxPersistent: number
  readonly #agentCatalog: AgentCatalog
  readonly #db: SubsStore

  constructor(ctx: Services, options: SwitchboardOptions) {
    super()

    this.#log = ctx.log
    this.#agentCatalog = ctx.agentCatalog
    this.#db = ctx.subsStore

    this.#stats = {
      ephemeral: 0,
      persistent: 0,
    }
    this.#maxEphemeral = options.subscriptionMaxEphemeral ?? 10_000
    this.#maxPersistent = options.subscriptionMaxPersistent ?? 10_000
  }

  /**
   * Subscribes to the given subscription(s).
   *
   * @param {NewSubscription | NewSubscription[]} subscription - The subscription(s).
   * @throws {SubscribeError | Error} If there is an error creating the subscription.
   */
  async subscribe(subscription: NewSubscription | NewSubscription[], subject: string = 'unknown') {
    if (Array.isArray(subscription)) {
      const tmp = []
      try {
        for (const s of subscription) {
          await this.#subscribe(s, subject)
          tmp.push(s)
        }
      } catch (error) {
        for (const s of tmp) {
          await this.unsubscribe(s.agent, s.id)
        }
        throw error
      }
    } else {
      await this.#subscribe(subscription, subject)
    }
  }

  /**
   * Adds a listener function to the underlying egress hub.
   *
   * This method is used by the web socket broadcaster.
   *
   * @param eventName - The publisher event name.
   * @param listener - The listener function.
   * @see {@link WebsocketProtocol}
   */
  addEgressListener(eventName: keyof PublisherEvents, listener: EgressListener) {
    this.#agentCatalog.addEgressListener(eventName, listener)
  }

  /**
   * Removes a listener function from the underlying egress hub.
   *
   * @param eventName - The publisher event name.
   * @param listener - The listener function.
   * @see {@link WebsocketProtocol}
   */
  removeEgressListener(eventName: keyof PublisherEvents, listener: EgressListener) {
    this.#agentCatalog.removeEgressListener(eventName, listener)
  }

  /**
   * Unsubscribes from the specified subscription by agent and subscription ID.
   *
   * If the subscription does not exist, it is ignored.
   *
   * @param {AgentId} agentId - The agent ID.
   * @param {string} subscriptionId - The subscription ID.
   */
  async unsubscribe(agentId: AgentId, subscriptionId: string) {
    try {
      const ephemeral = await this.#isEphemeral(agentId, subscriptionId)
      const agent = this.#agentCatalog.getSubscribableById(agentId)
      await agent.unsubscribe(subscriptionId)

      if (ephemeral) {
        this.#stats.ephemeral--
      } else {
        await this.#db.remove(agentId, subscriptionId)
        this.#stats.persistent--
      }
    } catch (error) {
      this.#log.error('[%s] error while unsubscribing: %s', agentId, subscriptionId, error)
    }
  }

  /**
   * Starts the switchboard.
   *
   * It will start all the platform agents.
   */
  async start() {
    for (const agentId of this.#agentCatalog.getAgentIds()) {
      const persistentSubs = await this.#db.getByAgentId(agentId)
      if (persistentSubs.length > 0) {
        this.#stats.persistent = persistentSubs.length
      }
      await this.#agentCatalog.startAgent(agentId, persistentSubs)
    }
  }

  async stop() {
    // This method can be used for cleanup if needed.
  }

  /**
   * Retrieves a subscription for an agent by agent id and subscription id.
   *
   * @param {AgentId} agentId The agent ID.
   * @param {string} subscriptionId The subscription ID.
   * @returns {Promise<Subscription>} The subscription with the specified ID.
   */
  async findSubscription(agentId: AgentId, subscriptionId: string): Promise<Subscription> {
    return await this.#db.getById(agentId, subscriptionId)
  }

  /**
   * Retrieves all subscriptions for a specific agent.
   *
   * @param agentId The agent ID.
   * @param subject The subject making the request.
   * @returns {Promise<PublicSubscription[]>} All subscriptions for the specified agent.
   */
  async getSubscriptionsByAgentId(
    agentId: string,
    subject: string = 'unknown',
  ): Promise<PublicSubscription[]> {
    const subs = await this.#db.getByAgentId(agentId)
    const pubs = subs
      .filter((sub) => sub.public || sub.owner === subject)
      .map((sub) => ({
        id: sub.id,
        agent: sub.agent,
        args: sub.args,
        owner: sub.owner,
        public: sub.public,
      }))
    return pubs
  }

  /**
   * Retrieves a subscription by its ID for a specific agent.
   *
   * @param agentId - The agent ID.
   * @param subscriptionId - The subscription ID.
   * @returns {Promise<Subscription>} The subscription with the specified ID.
   */
  async getSubscriptionById(agentId: AgentId, subscriptionId: string): Promise<Subscription> {
    return await this.#db.getById(agentId, subscriptionId)
  }

  /**
   * Updates an existing subscription by applying the given JSON patch.
   *
   * @param agentId - The agent ID.
   * @param subscriptionId - The subscription ID.
   * @param patch - The JSON patch operations.
   * @returns {Promise<Subscription>} The updated subscription object.
   */
  async updateSubscription(agentId: AgentId, subscriptionId: string, patch: Operation[]) {
    const agent = this.#agentCatalog.getSubscribableById(agentId)
    const updated = await agent.update(subscriptionId, patch)
    await this.#db.save(updated)
    return updated
  }

  /**
   * Collects telemetry data.
   *
   * Calls the given collect function for each private observable component.
   *
   * @param collect - The collect callback function.
   */
  collectTelemetry(collect: TelemetryCollect) {
    collect(this)
  }

  /**
   * Returns the in-memory subscription statistics.
   *
   * @returns {SubscriptionStats} The current subscription statistics.
   */
  get stats() {
    return this.#stats
  }

  /**
   * Internal method to handle subscription logic.
   *
   * @param {NewSubscription} newSubscription - The subscription to handle.
   * @throws {SubscribeError} If there are too many subscriptions.
   *
   * @private
   */
  async #subscribe(newSubscription: NewSubscription, subject: string) {
    if (this.#stats.ephemeral >= this.#maxEphemeral || this.#stats.persistent >= this.#maxPersistent) {
      throw new SubscribeError('too many subscriptions')
    }

    await this.#subscriptionShouldNotExist(newSubscription.agent, newSubscription.id)

    const agent = this.#agentCatalog.getSubscribableById(newSubscription.agent)

    agent.inputSchema.parse(newSubscription.args)

    const ownedSubscription = newSubscription as Subscription
    ownedSubscription.owner = subject

    await agent.subscribe(ownedSubscription)

    this.#log.info('[%s] new subscription: %j', ownedSubscription.agent, ownedSubscription)

    try {
      if (ownedSubscription.ephemeral) {
        this.#stats.ephemeral++
      } else {
        await this.#db.insert(ownedSubscription)
        this.#stats.persistent++
      }
    } catch (error) {
      this.#log.error(
        '[%s] error while persisting subscription: %s',
        ownedSubscription.agent,
        ownedSubscription.id,
        error,
      )
    }
  }

  async #isEphemeral(agentId: string, subscriptionId: string): Promise<boolean> {
    try {
      return (await this.getSubscriptionById(agentId, subscriptionId)).ephemeral ?? false
    } catch {
      return true
    }
  }

  async #subscriptionShouldNotExist(agentId: string, subscriptionId: string) {
    try {
      await this.getSubscriptionById(agentId, subscriptionId)
      throw new SubscribeError(
        `Subscription already exists (agentId=${agentId}, subscriptionId=${subscriptionId})`,
      )
    } catch (error) {
      if (error instanceof NotFound) {
        //
      } else {
        throw error
      }
    }
  }
}
