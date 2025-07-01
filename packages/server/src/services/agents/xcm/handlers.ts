import { Operation } from 'rfc6902'

import { Logger } from '@/services/index.js'
import { IngressConsumers } from '@/services/ingress/index.js'
import { Subscription } from '@/services/subscriptions/types.js'

import { SubscriptionUpdater, hasOp } from '../base/updater.js'
import type { XcmAgent } from './agent.js'
import { messageCriteria, notificationTypeCriteria, sendersCriteria } from './ops/criteria.js'
import { $XcmInputs, XcmInputs, XcmSubscriptionHandler } from './types/index.js'

const ALLOWED_PATHS = [
  '/args/senders',
  '/args/destinations',
  '/args/origins',
  '/args/events',
  '/channels',
  '/public',
]

/**
 * Manages the XCM agent subscription handlers.
 *
 * The subscription handlers are the active in-memory representation of a subscription.
 */
export class XcmSubscriptionManager {
  readonly #log: Logger
  readonly #agent: XcmAgent
  readonly #updater: SubscriptionUpdater
  readonly #handlers: Record<string, XcmSubscriptionHandler>

  constructor(log: Logger, ingress: IngressConsumers, agent: XcmAgent) {
    this.#log = log
    this.#agent = agent
    this.#updater = new SubscriptionUpdater(ingress, ALLOWED_PATHS)
    this.#handlers = {}
  }

  /**
   * Retrieves all subscription handlers.
   *
   * @returns {XcmSubscriptionHandler[]} All subscription handlers.
   */
  all() {
    return Object.values(this.#handlers)
  }

  /**
   * Deletes a subscription by its ID.
   *
   * @param {string} id - The subscription ID.
   */
  delete(id: string) {
    try {
      this.get(id).stream.unsubscribe()
      delete this.#handlers[id]
    } catch {
      //
    }
  }

  /**
   * Sets a subscription.
   *
   * @param {string} id - The subscription ID.
   * @param {XcmSubscriptionHandler} - handler The subscription handler.
   */
  set(id: string, handler: XcmSubscriptionHandler) {
    this.#handlers[id] = handler
  }

  /**
   * Checks if a subscription exists.
   *
   * @param {string} id - The subscription ID.
   * @returns {boolean} Whether the subscription exists.
   */
  has(id: string) {
    return this.#handlers[id] !== undefined
  }

  /**
   * Retrieves a subscription by its ID.
   *
   * @param {string} id - The subscription ID.
   * @returns {XcmSubscriptionHandler} The subscription handler.
   */
  get(id: string) {
    const handler = this.#handlers[id]
    if (handler === undefined) {
      throw new Error(`Subscription handler not found for ${id}`)
    }
    return handler
  }

  /**
   * Updates a subscription with a JSON patch.
   *
   * @param {string} subscriptionId - The subscription ID.
   * @param {Operation[]} patch - The JSON patch operations.
   * @returns {Subscription} The updated subscription.
   * @throws {ValidationError} If the patch contains disallowed operations.
   */
  update(subscriptionId: string, patch: Operation[]): Subscription {
    const toUpdate = this.#updater.prepare<XcmInputs>({
      handler: this.#handlers[subscriptionId],
      patch,
      argsSchema: $XcmInputs,
    })

    if (toUpdate.args.destinations !== '*') {
      this.#updater.validateNetworks(toUpdate.args.destinations)
    }
    if (toUpdate.args.origins !== '*') {
      this.#updater.validateNetworks(toUpdate.args.origins)
    }

    if (hasOp(patch, '/args/senders')) {
      this.#updateSenders(toUpdate)
    }

    if (hasOp(patch, '/args/destinations')) {
      this.#updateDestinations(toUpdate)
    }

    if (hasOp(patch, '/args/origins')) {
      this.#updateOrigins(toUpdate)
    }

    if (hasOp(patch, '/args/events')) {
      this.#updateEvents(toUpdate)
    }

    this.#updateDescriptor(toUpdate)

    return toUpdate
  }

  /**
   * Stops the handler manager
   */
  stop() {
    this.all().forEach((h) => {
      h.stream.unsubscribe()
    })
  }

  /**
   * Updates the notification events control handler.
   */
  #updateEvents(toUpdate: Subscription<XcmInputs>) {
    const {
      id,
      args: { events },
    } = toUpdate
    const { notificationTypeControl } = this.#handlers[id]

    notificationTypeControl.change(notificationTypeCriteria(events))
  }

  /**
   * Updates the senders control handler.
   *
   * Applies to the outbound extrinsic signers.
   */
  #updateSenders(toUpdate: Subscription<XcmInputs>) {
    const {
      id,
      args: { senders },
    } = toUpdate
    const { sendersControl } = this.#handlers[id]

    sendersControl.change(sendersCriteria(senders))
  }

  /**
   * Updates the oriigins control handler.
   */
  #updateOrigins(toUpdate: Subscription<XcmInputs>) {
    const {
      id,
      args: { origins },
    } = toUpdate
    const { originsControl } = this.#handlers[id]

    originsControl.change(messageCriteria(origins))
  }

  /**
   * Updates the message control handler.
   */
  #updateDestinations(toUpdate: Subscription<XcmInputs>) {
    const {
      id,
      args: { destinations },
    } = toUpdate
    const { destinationsControl } = this.#handlers[id]

    destinationsControl.change(messageCriteria(destinations))
  }

  #updateDescriptor(toUpdate: Subscription<XcmInputs>) {
    if (this.#handlers[toUpdate.id]) {
      this.#handlers[toUpdate.id].subscription = toUpdate
    } else {
      this.#log.warn('[%s] trying to update an unknown subscription %s', this.#agent.id, toUpdate.id)
    }
  }
}
