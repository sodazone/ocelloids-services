import EventEmitter from 'node:events'

import { Operation } from 'rfc6902'

import { Logger, Services } from '../types.js'
import { NotificationListener, Subscription, SubscriptionStats } from './types.js'

import { AgentId, AgentService } from '../agents/types.js'
import { NotifierEvents } from '../notification/types.js'
import { TelemetryCollect, TelemetryEventEmitter } from '../telemetry/types.js'

export enum SubscribeErrorCodes {
  TOO_MANY_SUBSCRIBERS,
}

/**
 * Custom error class for subscription-related errors.
 */
export class SubscribeError extends Error {
  code: SubscribeErrorCodes

  constructor(code: SubscribeErrorCodes, message: string) {
    super(message)

    Object.setPrototypeOf(this, SubscribeError.prototype)
    this.code = code
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
  readonly #agentService: AgentService

  constructor(ctx: Services, options: SwitchboardOptions) {
    super()

    this.#log = ctx.log
    this.#agentService = ctx.agentService

    this.#stats = {
      ephemeral: 0,
      persistent: 0,
    }
    this.#maxEphemeral = options.subscriptionMaxEphemeral ?? 10_000
    this.#maxPersistent = options.subscriptionMaxPersistent ?? 10_000
  }

  /**
   * Subscribes according to the given subscription.
   *
   * @param {Subscription} s The subscription.
   * @throws {SubscribeError} If there is an error creating the subscription.
   */
  async subscribe(s: Subscription) {
    if (this.#stats.ephemeral >= this.#maxEphemeral || this.#stats.persistent >= this.#maxPersistent) {
      throw new SubscribeError(SubscribeErrorCodes.TOO_MANY_SUBSCRIBERS, 'too many subscriptions')
    }

    const agent = this.#agentService.getAgentById(s.agent)
    await agent.subscribe(s)

    this.#log.info('[%s] new subscription: %j', s.agent, s)

    if (s.ephemeral) {
      this.#stats.ephemeral++
    } else {
      this.#stats.persistent++
    }
  }

  /**
   * Adds a listener function to the underlying notifier.
   *
   * This method is used by the web socket broadcaster.
   *
   * @param eventName The notifier event name.
   * @param listener The listener function.
   * @see {@link WebsocketProtocol}
   */
  addNotificationListener(eventName: keyof NotifierEvents, listener: NotificationListener) {
    this.#agentService.addNotificationListener(eventName, listener)
  }

  /**
   * Removes a listener function from the underlying notifier.
   *
   * @param eventName The notifier event name.
   * @param listener The listener function.
   * @see {@link WebsocketProtocol}
   */
  removeNotificationListener(eventName: keyof NotifierEvents, listener: NotificationListener) {
    this.#agentService.removeNotificationListener(eventName, listener)
  }

  /**
   * Unsubscribes by subsciption and agent identifier.
   *
   * If the subscription does not exists just ignores it.
   *
   * @param {AgentId} agentId The agent identifier.
   * @param {string} subscriptionId The subscription identifier.
   */
  async unsubscribe(agentId: AgentId, subscriptionId: string) {
    try {
      const agent = this.#agentService.getAgentById(agentId)
      const { ephemeral } = agent.getSubscriptionHandler(subscriptionId)
      await agent.unsubscribe(subscriptionId)

      if (ephemeral) {
        this.#stats.ephemeral--
      } else {
        this.#stats.persistent--
      }
    } catch {
      // ignore
    }
  }

  async start() {
    // This method can be used for initialization if needed.
  }

  async stop() {
    // This method can be used for cleanup if needed.
  }

  /**
   * Gets a subscription handler by id.
   *
   * @param {AgentId} agentId The agent identifier.
   * @param {string} subscriptionId The subscription identifier.
   */
  findSubscriptionHandler(agentId: AgentId, subscriptionId: string) {
    return this.#agentService.getAgentById(agentId).getSubscriptionHandler(subscriptionId)
  }

  /**
   * Gets all the subscriptions for all the known agents.
   *
   * @returns {Promise<Subscription[]>} All subscriptions.
   */
  async getAllSubscriptions(): Promise<Subscription[]> {
    const subs: Subscription[][] = []
    for (const agentId of this.#agentService.getAgentIds()) {
      subs.push(await this.#agentService.getAgentById(agentId).getAllSubscriptions())
    }
    return subs.flat()
  }

  /**
   * Gets all the subscriptions under an agent.
   *
   * @param agentId The agent identifier.
   * @returns {Promise<Subscription[]>} All subscriptions under the specified agent.
   */
  async getSubscriptionsByAgentId(agentId: string): Promise<Subscription[]> {
    return await this.#agentService.getAgentById(agentId).getAllSubscriptions()
  }

  /**
   * Gets a subscription by subscription identifier under an agent.
   *
   * @param agentId The agent identifier.
   * @param subscriptionId  The subscription identifier.
   * @returns {Promise<Subscription>} The subscription with the specified identifier.
   */
  async getSubscriptionById(agentId: AgentId, subscriptionId: string): Promise<Subscription> {
    return await this.#agentService.getAgentById(agentId).getSubscriptionById(subscriptionId)
  }

  /**
   * Updates an existing subscription applying the given JSON patch.
   *
   * @param agentId The agent identifier.
   * @param subscriptionId The subscription identifier
   * @param patch The JSON patch operations.
   * @returns {Promise<Subscription>} The updated subscription object.
   */
  updateSubscription(agentId: AgentId, subscriptionId: string, patch: Operation[]) {
    return this.#agentService.getAgentById(agentId).update(subscriptionId, patch)
  }

  /**
   * Calls the given collect function for each private observable component.
   *
   * @param collect The collect callback function.
   */
  collectTelemetry(collect: TelemetryCollect) {
    collect(this)
  }

  /**
   * Returns the in-memory subscription statistics.
   */
  get stats() {
    return this.#stats
  }
}
