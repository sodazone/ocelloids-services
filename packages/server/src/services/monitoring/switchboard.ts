import EventEmitter from 'node:events'

import { Logger, Services } from '../types.js'
import { AgentId, Subscription, SubscriptionStats, XcmEventListener } from './types.js'

import { AgentService } from 'agents/types.js'
import { Operation } from 'rfc6902'
import { NotifierHub } from '../notification/hub.js'
import { NotifierEvents } from '../notification/types.js'
import { TelemetryCollect, TelemetryEventEmitter } from '../telemetry/types.js'

export enum SubscribeErrorCodes {
  TOO_MANY_SUBSCRIBERS,
}

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
 * XCM Subscriptions Switchboard.
 *
 * Manages subscriptions and notifications for Cross-Consensus Message Format (XCM) formatted messages.
 * Enables subscribing to and unsubscribing from XCM messages of interest, handling 'matched' notifications,
 * and managing subscription lifecycles.
 * Monitors active subscriptions, processes incoming 'matched' notifications,
 * and dynamically updates selection criteria of the subscriptions.
 */
export class Switchboard extends (EventEmitter as new () => TelemetryEventEmitter) {
  readonly #log: Logger
  readonly #notifier: NotifierHub
  readonly #stats: SubscriptionStats
  readonly #maxEphemeral: number
  readonly #maxPersistent: number
  readonly #agentService: AgentService

  constructor(ctx: Services, options: SwitchboardOptions) {
    super()

    this.#log = ctx.log
    this.#agentService = ctx.agentService

    // TODO here could be local for websockets over event emitter or remote over redis
    this.#notifier = new NotifierHub(ctx)
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
   * @param eventName The notifier event name.
   * @param listener The listener function.
   */
  addNotificationListener(eventName: keyof NotifierEvents, listener: XcmEventListener) {
    this.#notifier.on(eventName, listener)
  }

  /**
   * Removes a listener function from the underlying notifier.
   *
   * @param eventName The notifier event name.
   * @param listener The listener function.
   */
  removeNotificationListener(eventName: keyof NotifierEvents, listener: XcmEventListener) {
    this.#notifier.off(eventName, listener)
  }

  /**
   * Unsubscribes by subsciption and agent identifier.
   *
   * If the subscription does not exists just ignores it.
   *
   * @param {AgentId} agentId The agent identifier.
   * @param {string} id The subscription identifier.
   */
  async unsubscribe(agentId: AgentId, id: string) {
    const agent = this.#agentService.getAgentById(agentId)
    const { ephemeral } = agent.getSubscriptionHandler(id)
    await agent.unsubscribe(id)

    if (ephemeral) {
      this.#stats.ephemeral--
    } else {
      this.#stats.persistent--
    }
  }

  async start() {
    // empty
  }

  /**
   * Stops the switchboard.
   */
  async stop() {
    // empty
  }

  /**
   * Gets a subscription handler by id.
   */
  findSubscriptionHandler(agentId: AgentId, id: string) {
    return this.#agentService.getAgentById(agentId).getSubscriptionHandler(id)
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    const subs: Subscription[][] = []
    for (const agentId of this.#agentService.getAgentIds()) {
      subs.push(await this.#agentService.getAgentById(agentId).getAllSubscriptions())
    }
    return subs.flat()
  }

  async getSubscriptionById(agentId: AgentId, subscriptionId: string): Promise<Subscription> {
    return await this.#agentService.getAgentById(agentId).getSubscriptionById(subscriptionId)
  }

  /**
   *
   * @param agentId
   * @param id
   * @param patch
   * @returns
   */
  updateSubscription(agentId: AgentId, id: string, patch: Operation[]) {
    return this.#agentService.getAgentById(agentId).update(id, patch)
  }

  /**
   * Calls the given collect function for each private observable component.
   *
   * @param collect The collect callback function.
   */
  collectTelemetry(collect: TelemetryCollect) {
    collect(this)
    // collect(this.#engine)
    collect(this.#notifier)
  }

  /**
   * Returns the in-memory subscription statistics.
   */
  get stats() {
    return this.#stats
  }
}
