import { Operation } from 'rfc6902'

import { errorMessage } from '@/errors.js'
import { Logger, NetworkURN } from '@/services/index.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { IngressConsumer } from 'services/ingress/index.js'
import { SubscriptionUpdater, hasOp } from '../base/updater.js'
import type { XcmAgent } from './agent.js'
import { messageCriteria, sendersCriteria } from './ops/criteria.js'
import { $XcmInputs, XcmInputs, XcmSubscriptionHandler } from './types.js'

const SUB_ERROR_RETRY_MS = 5000

const allowedPaths = ['/args/senders', '/args/destinations', '/channels', '/public', '/args/events']

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

  constructor(log: Logger, ingress: IngressConsumer, agent: XcmAgent) {
    this.#log = log
    this.#agent = agent
    this.#updater = new SubscriptionUpdater(ingress, allowedPaths)
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
    delete this.#handlers[id]
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
   * Checks if a subscription for a bridge exists.
   *
   * @param {string} id - The subscription ID.
   * @param {string} type - The bridge type.
   * @returns {boolean} Whether a subscription for the bridge exists.
   */
  hasSubscriptionForBridge(id: string, type: string) {
    return this.#handlers[id]?.bridgeSubs.find((s) => s.type === type) !== undefined
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
    return this.#handlers[id]
  }

  /**
   * Checks if a subscription for a destination exists.
   *
   * @param {string} id - The subscription ID.
   * @param {string} chainId - The chain ID.
   * @returns {boolean} Whether a subscription for the destination exists.
   */
  hasSubscriptionForDestination(id: string, chainId: string) {
    return this.#handlers[id]?.destinationSubs.find((s) => s.chainId === chainId) !== undefined
  }

  /**
   * Checks if a subscription for an origin exists.
   *
   * @param {string} id - The subscription ID.
   * @param {string} chainId - The chain ID.
   * @returns {boolean} Whether a subscription for the origin exists.
   */
  hasSubscriptionForOrigin(id: string, chainId: string) {
    return this.#handlers[id]?.originSubs.find((s) => s.chainId === chainId) !== undefined
  }

  /**
   * Checks if a relay subscription exists.
   *
   * @param {string} id - The subscription ID.
   * @returns {boolean} Whether a relay subscription exists.
   */
  hasSubscriptionForRelay(id: string) {
    return this.#handlers[id]?.relaySub !== undefined
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

    this.#updater.validateNetworks(toUpdate.args.destinations)

    if (hasOp(patch, '/args/senders')) {
      this.#updateSenders(toUpdate)
    }

    if (hasOp(patch, '/args/destinations')) {
      this.#updateDestinationMessageControl(toUpdate)
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
    //
  }

  /**
   * Attempts to recover a relay subscription after an error.
   *
   * @param {Error} error - The error that occurred.
   * @param {string} id - The subscription ID.
   * @param {string} chainId - The chain ID.
   */
  tryRecoverRelay(error: Error, id: string, chainId: string) {
    // try recover relay subscription
    // there is only one subscription per subscription ID for relay
    if (this.has(id) && this.hasSubscriptionForRelay(id)) {
      const sub = this.get(id)

      sub.relaySub?.sub.unsubscribe()
      delete sub.relaySub

      setTimeout(() => {
        this.#log.info(
          '[%s:%s] UPDATE relay subscription %s due error %s',
          this.#agent.id,
          chainId,
          id,
          errorMessage(error),
        )
        const updatedSub = this.#agent.__monitorRelay(sub.subscription)
        sub.relaySub = updatedSub
      }, SUB_ERROR_RETRY_MS).unref()
    }
  }

  /**
   * Attempts to recover a bridge subscription after an error.
   *
   * @param {Error} error - The error that occurred.
   * @param {string} id - The subscription ID.
   * @param {string} type - The bridge type.
   * @param {string} originBridgeHub - The origin bridge hub.
   */
  tryRecoverBridge(error: Error, id: string, type: string, originBridgeHub: string) {
    // try recover pk bridge subscription
    if (this.has(id)) {
      const sub = this.get(id)
      const { bridgeSubs } = sub
      const index = bridgeSubs.findIndex((s) => s.type === type)
      if (index > -1) {
        const rmds = bridgeSubs.splice(index, 1)
        for (const rmd of rmds[0].subs) {
          rmd.sub.unsubscribe()
        }
        setTimeout(() => {
          this.#log.info(
            '[%s:%s] UPDATE destination subscription %s due error %s',
            this.#agent.id,
            originBridgeHub,
            id,
            errorMessage(error),
          )
          bridgeSubs.push(this.#agent.__monitorPkBridge(sub.subscription))
          sub.bridgeSubs = bridgeSubs
        }, SUB_ERROR_RETRY_MS).unref()
      }
    }
  }

  /**
   * Attempts to recover an inbound subscription after an error.
   *
   * @param {Error} error - The error that occurred.
   * @param {string} id - The subscription ID.
   * @param {string} chainId - The chain ID.
   */
  tryRecoverInbound(error: Error, id: string, chainId: string) {
    // try recover inbound subscription
    if (this.has(id)) {
      const { destinationSubs } = this.get(id)
      const index = destinationSubs.findIndex((s) => s.chainId === chainId)
      if (index > -1) {
        const rmds = destinationSubs.splice(index, 1)
        for (const rmd of rmds) {
          rmd.sub.unsubscribe()
        }
        setTimeout(() => {
          this.#log.info(
            '[%s:%s] UPDATE destination subscription %s due error %s',
            this.#agent.id,
            chainId,
            id,
            errorMessage(error),
          )
          const updated = this.#updateDestinationSubscriptions(this.#handlers[id].subscription)
          this.#handlers[id].destinationSubs = updated
        }, SUB_ERROR_RETRY_MS).unref()
      }
    }
  }

  /**
   * Attempts to recover an outbound subscription after an error.
   *
   * @param {Error} error - The error that occurred.
   * @param {string} id - The subscription ID.
   * @param {string} chainId - The chain ID.
   */
  tryRecoverOutbound(error: Error, id: string, chainId: string) {
    // try recover outbound subscription
    // note: there is a single origin per outbound
    if (this.has(id)) {
      const { originSubs, subscription } = this.get(id)
      const index = originSubs.findIndex((s) => s.chainId === chainId)
      if (index > -1) {
        for (const { sub } of this.#handlers[id].originSubs) {
          sub.unsubscribe()
        }
        this.#handlers[id].originSubs = []
        setTimeout(() => {
          if (this.#handlers[id]) {
            this.#log.info(
              '[%s:%s] UPDATE origin subscription %s due error %s',
              this.#agent.id,
              chainId,
              id,
              errorMessage(error),
            )
            const { streams: updated, controls } = this.#agent.__monitorOrigins(subscription)
            this.#handlers[id].sendersControl = controls.sendersControl
            this.#handlers[id].messageControl = controls.messageControl
            this.#handlers[id].originSubs = updated
          }
        }, SUB_ERROR_RETRY_MS).unref()
      }
    }
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
   * Updates the message control handler.
   */
  #updateDestinationMessageControl(toUpdate: Subscription<XcmInputs>) {
    const {
      id,
      args: { destinations },
    } = toUpdate
    const { messageControl } = this.#handlers[id]

    messageControl.change(messageCriteria(destinations as NetworkURN[]))

    const updatedSubs = this.#updateDestinationSubscriptions(toUpdate)
    this.#handlers[id].destinationSubs = updatedSubs
  }

  /**
   * Updates the destination subscriptions.
   *
   * @param {Subscription} toUpdate - The subscription to update.
   * @returns {Subscription[]} The updated destination subscriptions.
   */
  #updateDestinationSubscriptions(toUpdate: Subscription<XcmInputs>) {
    const { id } = toUpdate
    const { destinationSubs } = this.#handlers[id]
    // Subscribe to new destinations, if any
    const { streams: subs } = this.#agent.__monitorDestinations(toUpdate)
    const updatedSubs = destinationSubs.concat(subs)
    // Unsubscribe removed destinations, if any
    const removed = updatedSubs.filter((s) => !toUpdate.args.destinations.includes(s.chainId))
    removed.forEach(({ sub }) => sub.unsubscribe())
    // Return list of updated subscriptions
    return updatedSubs.filter((s) => !removed.includes(s))
  }

  /**
   * Updates the subscription to relayed HRMP messages in the relay chain.
   */
  #updateEvents(toUpdate: Subscription<XcmInputs>) {
    const { id } = toUpdate
    const { relaySub } = this.#handlers[id]

    if (this.#agent.__shouldMonitorRelay(toUpdate.args) && relaySub === undefined) {
      try {
        this.#handlers[id].relaySub = this.#agent.__monitorRelay(toUpdate)
      } catch (error) {
        // log instead of throw to not block OD subscriptions
        this.#log.error(error, '[%s] error on relay subscription %s', this.#agent.id, id)
      }
    } else if (!this.#agent.__shouldMonitorRelay(toUpdate.args) && relaySub !== undefined) {
      relaySub.sub.unsubscribe()
      delete this.#handlers[id].relaySub
    }
  }

  #updateDescriptor(toUpdate: Subscription<XcmInputs>) {
    if (this.#handlers[toUpdate.id]) {
      this.#handlers[toUpdate.id].subscription = toUpdate
    } else {
      this.#log.warn('[%s] trying to update an unknown subscription %s', this.#agent.id, toUpdate.id)
    }
  }
}
