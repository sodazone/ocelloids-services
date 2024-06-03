import { Operation, applyPatch } from 'rfc6902'

import { NotFound, ValidationError, errorMessage } from '../../../errors.js'
import { Logger, NetworkURN } from '../../index.js'
import { $Subscription, Subscription } from '../../subscriptions/types.js'
import { messageCriteria, sendersCriteria } from './ops/criteria.js'
import { $XCMSubscriptionArgs, XcmSubscriptionHandler } from './types.js'
import { XcmAgent } from './agent.js'

const SUB_ERROR_RETRY_MS = 5000

const allowedPaths = ['/args/senders', '/args/destinations', '/channels', '/args/events']

function hasOp(patch: Operation[], path: string) {
  return patch.some((op) => op.path.startsWith(path))
}

/**
 * Manages the XCM agent subscription handlers.
 *
 * The subscription handlers are the active in-memory representation of a subscription.
 */
export class XcmSubscriptionManager {
  readonly #log: Logger
  readonly #agent: XcmAgent
  readonly #handlers: Record<string, XcmSubscriptionHandler>
  readonly #timeouts: NodeJS.Timeout[]

  constructor(log: Logger, agent: XcmAgent) {
    this.#log = log
    this.#agent = agent
    this.#handlers = {}
    this.#timeouts = []
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
    return this.#handlers[id]?.bridgeSubs.find((s) => s.type === type)
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
    return this.#handlers[id]?.destinationSubs.find((s) => s.chainId === chainId)
  }

  /**
   * Checks if a subscription for an origin exists.
   * 
   * @param {string} id - The subscription ID.
   * @param {string} chainId - The chain ID.
   * @returns {boolean} Whether a subscription for the origin exists.
   */
  hasSubscriptionForOrigin(id: string, chainId: string) {
    return this.#handlers[id]?.originSubs.find((s) => s.chainId === chainId)
  }

  /**
   * Checks if a relay subscription exists.
   * 
   * @param {string} id - The subscription ID.
   * @returns {boolean} Whether a relay subscription exists.
   */
  hasSubscriptionForRelay(id: string) {
    return this.#handlers[id]?.relaySub
  }

  /**
   * Retrieves a subscription handler by its ID.
   * 
   * @param {string} subscriptionId - The subscription ID.
   * @returns {XcmSubscriptionHandler} - The subscription handler.
   * @throws {NotFound} If the subscription handler is not found.
   */
  getSubscriptionHandler(subscriptionId: string): XcmSubscriptionHandler {
    if (this.#handlers[subscriptionId]) {
      return this.#handlers[subscriptionId]
    } else {
      throw new NotFound(`Subscription handler not found (id=${subscriptionId})`)
    }
  }

  /**
   * Updates a subscription with a JSON patch.
   * 
   * @param {string} subscriptionId - The subscription ID.
   * @param {Operation[]} patch - The JSON patch operations.
   * @returns {Promise<Subscription>} The updated subscription.
   * @throws {ValidationError} If the patch contains disallowed operations.
   */
  async update(subscriptionId: string, patch: Operation[]): Promise<Subscription> {
    const sub = this.#handlers[subscriptionId]
    const descriptor = sub.descriptor

    // Check allowed patch ops
    const allowedOps = patch.every((op) => allowedPaths.some((s) => op.path.startsWith(s)))

    if (allowedOps) {
      applyPatch(descriptor, patch)
      $Subscription.parse(descriptor)
      const args = $XCMSubscriptionArgs.parse(descriptor.args)

      sub.args = args
      sub.descriptor = descriptor

      if (hasOp(patch, '/args/senders')) {
        this.#updateSenders(subscriptionId)
      }

      if (hasOp(patch, '/args/destinations')) {
        this.#updateDestinationMessageControl(subscriptionId)
      }

      if (hasOp(patch, '/args/events')) {
        this.#updateEvents(subscriptionId)
      }

      this.#updateDescriptor(descriptor)

      return descriptor
    } else {
      throw new ValidationError('Only operations on these paths are allowed: ' + allowedPaths.join(','))
    }
  }

  /**
   * Stops all active timeouts.
   */
  stop() {
    for (const t of this.#timeouts) {
      t.unref()
    }
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
    if (this.has(id)) {
      const sub = this.get(id)
      this.#timeouts.push(
        setTimeout(async () => {
          this.#log.info('[%s] UPDATE relay subscription %s due error %s', chainId, id, errorMessage(error))
          const updatedSub = await this.#agent._monitorRelay(sub.descriptor, sub.args)
          sub.relaySub = updatedSub
        }, SUB_ERROR_RETRY_MS)
      )
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
        bridgeSubs.splice(index, 1)
        this.#timeouts.push(
          setTimeout(() => {
            this.#log.info(
              '[%s] UPDATE destination subscription %s due error %s',
              originBridgeHub,
              id,
              errorMessage(error)
            )
            bridgeSubs.push(this.#agent._monitorPkBridge(sub.descriptor, sub.args))
            sub.bridgeSubs = bridgeSubs
          }, SUB_ERROR_RETRY_MS)
        )
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
        destinationSubs.splice(index, 1)
        this.#timeouts.push(
          setTimeout(() => {
            this.#log.info('[%s] UPDATE destination subscription %s due error %s', chainId, id, errorMessage(error))
            const updated = this.#updateDestinationSubscriptions(id)
            this.#handlers[id].destinationSubs = updated
          }, SUB_ERROR_RETRY_MS)
        )
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
      const { originSubs, descriptor, args } = this.get(id)
      const index = originSubs.findIndex((s) => s.chainId === chainId)
      if (index > -1) {
        this.#handlers[id].originSubs = []
        this.#timeouts.push(
          setTimeout(() => {
            if (this.#handlers[id]) {
              this.#log.info('[%s] UPDATE origin subscription %s due error %s', chainId, id, errorMessage(error))
              const { subs: updated, controls } = this.#agent._monitorOrigins(descriptor, args)
              this.#handlers[id].sendersControl = controls.sendersControl
              this.#handlers[id].messageControl = controls.messageControl
              this.#handlers[id].originSubs = updated
            }
          }, SUB_ERROR_RETRY_MS)
        )
      }
    }
  }

  /**
   * Updates the senders control handler.
   *
   * Applies to the outbound extrinsic signers.
   */
  #updateSenders(id: string) {
    const {
      args: { senders },
      sendersControl,
    } = this.#handlers[id]

    sendersControl.change(sendersCriteria(senders))
  }

  /**
   * Updates the message control handler.
   * 
   * @param {string} id - The subscription ID.
   */
  #updateDestinationMessageControl(id: string) {
    const { args, messageControl } = this.#handlers[id]

    messageControl.change(messageCriteria(args.destinations as NetworkURN[]))

    const updatedSubs = this.#updateDestinationSubscriptions(id)
    this.#handlers[id].destinationSubs = updatedSubs
  }

  /**
   * Updates the destination subscriptions.
   * 
   * @param {string} id - The subscription ID.
   * @returns {Subscription[]} The updated destination subscriptions.
   */
  #updateDestinationSubscriptions(id: string) {
    const { descriptor, args, destinationSubs } = this.#handlers[id]
    // Subscribe to new destinations, if any
    const { subs } = this.#agent._monitorDestinations(descriptor, args)
    const updatedSubs = destinationSubs.concat(subs)
    // Unsubscribe removed destinations, if any
    const removed = updatedSubs.filter((s) => !args.destinations.includes(s.chainId))
    removed.forEach(({ sub }) => sub.unsubscribe())
    // Return list of updated subscriptions
    return updatedSubs.filter((s) => !removed.includes(s))
  }

  /**
   * Updates the subscription to relayed HRMP messages in the relay chain.
   */
  #updateEvents(id: string) {
    const { descriptor, args, relaySub } = this.#handlers[id]

    if (this.#agent._shouldMonitorRelay(args) && relaySub === undefined) {
      try {
        this.#handlers[id].relaySub = this.#agent._monitorRelay(descriptor, args)
      } catch (error) {
        // log instead of throw to not block OD subscriptions
        this.#log.error(error, '[%s] error on relay subscription (%s)', this.#agent.id, id)
      }
    } else if (!this.#agent._shouldMonitorRelay(args) && relaySub !== undefined) {
      relaySub.sub.unsubscribe()
      delete this.#handlers[id].relaySub
    }
  }

  #updateDescriptor(sub: Subscription) {
    if (this.#handlers[sub.id]) {
      this.#handlers[sub.id].descriptor = sub
    } else {
      this.#log.warn('[%s] trying to update an unknown subscription %s', this.#agent.id, sub.id)
    }
  }
}
