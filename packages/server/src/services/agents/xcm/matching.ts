import EventEmitter from 'node:events'

import { AbstractSublevel } from 'abstract-level'
import { Mutex } from 'async-mutex'

import { DB, Logger, jsonEncoded, prefixes } from '../../types.js'
import {
  GenericXcmBridge,
  GenericXcmHop,
  GenericXcmReceived,
  GenericXcmRelayed,
  GenericXcmTimeout,
  XcmBridge,
  XcmBridgeAcceptedWithContext,
  XcmBridgeDeliveredWithContext,
  XcmBridgeInboundWithContext,
  XcmHop,
  XcmInbound,
  XcmNotifyMessage,
  XcmReceived,
  XcmRelayed,
  XcmRelayedWithContext,
  XcmSent,
  XcmTimeout,
  XcmWaypointContext,
} from './types.js'

import { getRelayId, isOnSameConsensus } from '../../config.js'
import { Janitor, JanitorTask } from '../../persistence/janitor.js'
import { AgentRuntimeContext } from '../types.js'
import { TelemetryXCMEventEmitter } from './telemetry/events.js'

export type XcmMatchedReceiver = (message: XcmNotifyMessage) => Promise<void> | void
type SubLevel<TV> = AbstractSublevel<DB, Buffer | Uint8Array | string, string, TV>

export type ChainBlock = {
  chainId: string
  blockHash: string
  blockNumber: string
}

const DEFAULT_TIMEOUT = 2 * 60000
/**
 * Matches sent XCM messages on the destination.
 * It does not assume any ordering.
 *
 * Current matching logic takes into account that messages at origin and destination
 * might or might not have a unique ID set via SetTopic instruction.
 * Therefore, it supports matching logic using both message hash and message ID.
 *
 * When unique message ID is implemented in all XCM events, we can:
 * - simplify logic to match only by message ID
 * - check notification storage by message ID and do not store for matching if already matched
 */
export class MatchingEngine extends (EventEmitter as new () => TelemetryXCMEventEmitter) {
  readonly #log: Logger
  readonly #janitor: Janitor

  readonly #outbound: SubLevel<XcmSent>
  readonly #inbound: SubLevel<XcmInbound>
  readonly #relay: SubLevel<XcmRelayedWithContext>
  readonly #hop: SubLevel<XcmSent>
  readonly #bridge: SubLevel<XcmSent>
  readonly #bridgeAccepted: SubLevel<XcmBridge>
  readonly #bridgeInbound: SubLevel<XcmBridgeInboundWithContext>
  readonly #mutex: Mutex
  readonly #xcmMatchedReceiver: XcmMatchedReceiver

  constructor({ log, rootStore, janitor }: AgentRuntimeContext, xcmMatchedReceiver: XcmMatchedReceiver) {
    super()

    this.#log = log
    this.#janitor = janitor
    this.#mutex = new Mutex()
    this.#xcmMatchedReceiver = xcmMatchedReceiver

    // Key format: [subscription-id]:[destination-chain-id]:[message-id/hash]
    this.#outbound = rootStore.sublevel<string, XcmSent>(prefixes.matching.outbound, jsonEncoded)
    // Key format: [subscription-id]:[current-chain-id]:[message-id/hash]
    this.#inbound = rootStore.sublevel<string, XcmInbound>(prefixes.matching.inbound, jsonEncoded)
    // Key format: [subscription-id]:[relay-outbound-chain-id]:[message-id/hash]
    this.#relay = rootStore.sublevel<string, XcmRelayedWithContext>(prefixes.matching.relay, jsonEncoded)
    // Key format: [subscription-id]:[hop-stop-chain-id]:[message-id/hash]
    this.#hop = rootStore.sublevel<string, XcmSent>(prefixes.matching.hop, jsonEncoded)
    // Key format: [subscription-id]:[bridge-chain-id]:[message-id]
    this.#bridge = rootStore.sublevel<string, XcmSent>(prefixes.matching.bridge, jsonEncoded)

    // Key format: [subscription-id]:[bridge-key]
    this.#bridgeAccepted = rootStore.sublevel<string, XcmBridge>(prefixes.matching.bridgeAccepted, jsonEncoded)
    // Key format: [subscription-id]:[bridge-key]
    this.#bridgeInbound = rootStore.sublevel<string, XcmBridgeInboundWithContext>(
      prefixes.matching.bridgeIn,
      jsonEncoded
    )

    this.#janitor.on('sweep', this.#onXcmSwept.bind(this))
  }

  async onOutboundMessage(outMsg: XcmSent, outboundTTL: number = DEFAULT_TIMEOUT) {
    const log = this.#log

    // Confirmation key at destination
    await this.#mutex.runExclusive(async () => {
      const hashKey = this.#matchingKey(outMsg.subscriptionId, outMsg.destination.chainId, outMsg.waypoint.messageHash)
      // try to get any stored relay messages and notify if found.
      // do not clean up outbound in case inbound has not arrived yet.
      await this.#findRelayInbound(outMsg)

      if (outMsg.forwardId !== undefined) {
        // Is bridged message
        // Try to match origin message (on other consensus) using the forward ID.
        // If found, create outbound message with origin context and current waypoint context
        // before trying to match inbound (on same consensus).
        // If origin message not found, treat as normal XCM outbound
        try {
          const {
            subscriptionId,
            origin: { chainId },
            messageId,
            forwardId,
            waypoint,
          } = outMsg
          const forwardIdKey = this.#matchingKey(subscriptionId, chainId, forwardId)
          const originMsg = await this.#bridge.get(forwardIdKey)

          const bridgedSent: XcmSent = {
            ...originMsg,
            waypoint,
            messageId,
            forwardId,
          }
          this.#onXcmOutbound(bridgedSent)
          await this.#tryMatchOnOutbound(bridgedSent, outboundTTL)
          await this.#bridge.del(forwardIdKey)
        } catch {
          this.#onXcmOutbound(outMsg)
          await this.#tryMatchOnOutbound(outMsg, outboundTTL)
        }
      } else if (outMsg.messageId) {
        // Is not bridged message
        // First try to match by hop key
        // If found, emit hop, and do not store anything
        // If no matching hop key, assume is origin outbound message -> try to match inbound
        // We assume that the original origin message is ALWAYS received first.
        // NOTE: hops can only use idKey since message hash will be different on each hop
        try {
          const hopKey = this.#matchingKey(outMsg.subscriptionId, outMsg.origin.chainId, outMsg.messageId)
          const originMsg = await this.#hop.get(hopKey)
          log.info(
            '[%s:h] MATCHED HOP OUT origin=%s id=%s (subId=%s, block=%s #%s)',
            outMsg.origin.chainId,
            originMsg.origin.chainId,
            hopKey,
            outMsg.subscriptionId,
            outMsg.origin.blockHash,
            outMsg.origin.blockNumber
          )
          // do not delete hop key because maybe hop stop inbound hasn't arrived yet
          this.#onXcmHopOut(originMsg, outMsg)
        } catch {
          this.#onXcmOutbound(outMsg)
          // Try to get stored inbound messages and notify if any
          // If inbound messages are found, clean up outbound.
          // If not found, store outbound message in #outbound to match destination inbound
          // and #hop to match hop outbounds and inbounds.
          // Note: if relay messages arrive after outbound and inbound, it will not match.
          await this.#tryMatchOnOutbound(outMsg, outboundTTL)
        }
      } else {
        this.#onXcmOutbound(outMsg)
        // try to get stored inbound messages by message hash and notify if any
        try {
          const inMsg = await this.#inbound.get(hashKey)
          log.info(
            '[%s:o] MATCHED hash=%s (subId=%s, block=%s #%s)',
            outMsg.origin.chainId,
            hashKey,
            outMsg.subscriptionId,
            outMsg.origin.blockHash,
            outMsg.origin.blockNumber
          )
          await this.#inbound.del(hashKey)
          this.#onXcmMatched(outMsg, inMsg)
        } catch {
          await this.#storekeysOnOutbound(outMsg, outboundTTL)
        }
      }
    })

    return outMsg
  }

  async onInboundMessage(inMsg: XcmInbound) {
    const log = this.#log

    await this.#mutex.runExclusive(async () => {
      let hashKey = this.#matchingKey(inMsg.subscriptionId, inMsg.chainId, inMsg.messageHash)
      let idKey = this.#matchingKey(inMsg.subscriptionId, inMsg.chainId, inMsg.messageId)

      if (hashKey === idKey) {
        // if hash and id are the same, both could be the message hash or both could be the message id
        try {
          const outMsg = await this.#outbound.get(hashKey)
          log.info(
            '[%s:i] MATCHED hash=%s (subId=%s, block=%s #%s)',
            inMsg.chainId,
            hashKey,
            inMsg.subscriptionId,
            inMsg.blockHash,
            inMsg.blockNumber
          )
          // if outbound has no messageId, we can safely assume that
          // idKey and hashKey are made up of only the message hash.
          // if outbound has messageId, we need to reconstruct idKey and hashKey
          // using outbound values to ensure that no dangling keys will be left on janitor sweep.
          if (outMsg.messageId !== undefined) {
            idKey = this.#matchingKey(inMsg.subscriptionId, inMsg.chainId, outMsg.messageId)
            hashKey = this.#matchingKey(inMsg.subscriptionId, inMsg.chainId, outMsg.waypoint.messageHash)
          }
          await this.#outbound.batch().del(idKey).del(hashKey).write()
          this.#onXcmMatched(outMsg, inMsg)
        } catch {
          await this.#tryHopMatchOnInbound(inMsg)
        }
      } else {
        try {
          const outMsg = await Promise.any([this.#outbound.get(idKey), this.#outbound.get(hashKey)])
          // Reconstruct hashKey with outbound message hash in case of hopped messages
          hashKey = this.#matchingKey(inMsg.subscriptionId, inMsg.chainId, outMsg.waypoint.messageHash)
          log.info(
            '[%s:i] MATCHED hash=%s id=%s (subId=%s, block=%s #%s)',
            inMsg.chainId,
            hashKey,
            idKey,
            inMsg.subscriptionId,
            inMsg.blockHash,
            inMsg.blockNumber
          )
          await this.#outbound.batch().del(idKey).del(hashKey).write()
          this.#onXcmMatched(outMsg, inMsg)
        } catch {
          await this.#tryHopMatchOnInbound(inMsg)
        }
      }
    })
  }

  async onRelayedMessage(subscriptionId: string, relayMsg: XcmRelayedWithContext) {
    const log = this.#log

    const relayId = getRelayId(relayMsg.origin)
    const idKey = relayMsg.messageId
      ? this.#matchingKey(subscriptionId, relayMsg.recipient, relayMsg.messageId)
      : this.#matchingKey(subscriptionId, relayMsg.recipient, relayMsg.messageHash)

    await this.#mutex.runExclusive(async () => {
      try {
        const outMsg = await this.#outbound.get(idKey)
        log.info(
          '[%s:r] RELAYED origin=%s recipient=%s (subId=%s, block=%s #%s)',
          relayId,
          relayMsg.origin,
          relayMsg.recipient,
          subscriptionId,
          relayMsg.blockHash,
          relayMsg.blockNumber
        )
        await this.#relay.del(idKey)
        await this.#onXcmRelayed(outMsg, relayMsg)
      } catch {
        const relayKey = relayMsg.messageId
          ? this.#matchingKey(subscriptionId, relayMsg.origin, relayMsg.messageId)
          : this.#matchingKey(subscriptionId, relayMsg.origin, relayMsg.messageHash)
        log.info(
          '[%s:r] STORED relayKey=%s origin=%s recipient=%s (subId=%s, block=%s #%s)',
          relayId,
          relayKey,
          relayMsg.origin,
          relayMsg.recipient,
          subscriptionId,
          relayMsg.blockHash,
          relayMsg.blockNumber
        )
        await this.#relay.put(relayKey, relayMsg)
        await this.#janitor.schedule({
          sublevel: prefixes.matching.relay,
          key: relayKey,
        })
      }
    })
  }

  async onBridgeOutboundAccepted(subscriptionId: string, msg: XcmBridgeAcceptedWithContext) {
    const log = this.#log

    await this.#mutex.runExclusive(async () => {
      if (msg.forwardId === undefined) {
        log.error(
          '[%s] forward_id_to not found for bridge accepted message (sub=%s block=%s #%s)',
          msg.chainId,
          subscriptionId,
          msg.blockHash,
          msg.blockNumber
        )
        return
      }
      const { chainId, forwardId, bridgeKey } = msg
      const idKey = this.#matchingKey(subscriptionId, chainId, forwardId)

      try {
        const originMsg = await this.#bridge.get(idKey)

        const { blockHash, blockNumber, event, messageData, instructions, messageHash } = msg
        const legIndex = originMsg.legs.findIndex((l) => l.from === chainId && l.type === 'bridge')
        const waypointContext: XcmWaypointContext = {
          legIndex,
          chainId,
          blockHash,
          blockNumber: blockNumber.toString(),
          event,
          messageData,
          messageHash,
          instructions,
          outcome: 'Success', // always 'Success' since it's delivered
          error: null,
        }
        const bridgeOutMsg: XcmBridge = new GenericXcmBridge(originMsg, waypointContext, {
          bridgeMessageType: 'accepted',
          bridgeKey,
          forwardId,
        })
        const sublevelBridgeKey = `${subscriptionId}:${bridgeKey}`
        await this.#bridgeAccepted.put(sublevelBridgeKey, bridgeOutMsg)
        await this.#janitor.schedule({
          sublevel: prefixes.matching.bridgeAccepted,
          key: sublevelBridgeKey,
        })
        log.info(
          '[%s:ba] BRIDGE MESSAGE ACCEPTED key=%s (subId=%s, block=%s #%s)',
          chainId,
          sublevelBridgeKey,
          subscriptionId,
          msg.blockHash,
          msg.blockNumber
        )
        this.#onXcmBridgeAccepted(bridgeOutMsg)
      } catch {
        log.warn(
          '[%s:ba] ORIGIN MSG NOT FOUND id=%s (subId=%s, block=%s #%s)',
          chainId,
          idKey,
          subscriptionId,
          msg.blockHash,
          msg.blockNumber
        )
      }
    })
  }

  async onBridgeOutboundDelivered(subscriptionId: string, msg: XcmBridgeDeliveredWithContext) {
    const log = this.#log

    await this.#mutex.runExclusive(async () => {
      const { chainId, bridgeKey } = msg
      const sublevelBridgeKey = `${subscriptionId}:${bridgeKey}`
      try {
        const bridgeOutMsg = await this.#bridgeAccepted.get(sublevelBridgeKey)
        try {
          const bridgeInMsg = await this.#bridgeInbound.get(sublevelBridgeKey)
          log.info(
            '[%s:bd] BRIDGE MATCHED key=%s (subId=%s, block=%s #%s)',
            chainId,
            sublevelBridgeKey,
            subscriptionId,
            msg.blockHash,
            msg.blockNumber
          )
          await this.#bridgeInbound.del(sublevelBridgeKey)
          await this.#bridgeAccepted.del(sublevelBridgeKey)
          this.#onXcmBridgeDelivered({ ...bridgeOutMsg, bridgeMessageType: 'delivered' })
          this.#onXcmBridgeMatched(bridgeOutMsg, bridgeInMsg)
        } catch {
          this.#log.info(
            '[%s:bo] BRIDGE DELIVERED key=%s (subId=%s, block=%s #%s)',
            chainId,
            sublevelBridgeKey,
            subscriptionId,
            msg.blockHash,
            msg.blockNumber
          )
          this.#onXcmBridgeDelivered(bridgeOutMsg)
        }
      } catch {
        log.warn(
          '[%s:bd] BRIDGE ACCEPTED MSG NOT FOUND key=%s (subId=%s, block=%s #%s)',
          chainId,
          sublevelBridgeKey,
          subscriptionId,
          msg.blockHash,
          msg.blockNumber
        )
      }
    })
  }

  async onBridgeInbound(subscriptionId: string, bridgeInMsg: XcmBridgeInboundWithContext) {
    const log = this.#log

    await this.#mutex.runExclusive(async () => {
      const { chainId, bridgeKey } = bridgeInMsg
      const sublevelBridgeKey = `${subscriptionId}:${bridgeKey}`

      try {
        const bridgeOutMsg = await this.#bridgeAccepted.get(sublevelBridgeKey)
        log.info(
          '[%s:bi] BRIDGE MATCHED key=%s (subId=%s, block=%s #%s)',
          chainId,
          sublevelBridgeKey,
          subscriptionId,
          bridgeInMsg.blockHash,
          bridgeInMsg.blockNumber
        )
        await this.#bridgeAccepted.del(sublevelBridgeKey)
        this.#onXcmBridgeMatched(bridgeOutMsg, bridgeInMsg)
      } catch {
        this.#log.info(
          '[%s:bi] BRIDGE IN STORED id=%s (subId=%s, block=%s #%s)',
          chainId,
          sublevelBridgeKey,
          subscriptionId,
          bridgeInMsg.blockHash,
          bridgeInMsg.blockNumber
        )
        this.#bridgeInbound.put(sublevelBridgeKey, bridgeInMsg)
        await this.#janitor.schedule({
          sublevel: prefixes.matching.bridgeIn,
          key: sublevelBridgeKey,
        })
      }
    })
  }

  // try to find in DB by hop key
  // if found, emit hop, and do not store anything
  // if no matching hop key, assume is destination inbound and store.
  // We assume that the original origin message is ALWAYS received first.
  // NOTE: hops can only use idKey since message hash will be different on each hop
  async #tryHopMatchOnInbound(msg: XcmInbound) {
    const log = this.#log
    try {
      const hopKey = this.#matchingKey(msg.subscriptionId, msg.chainId, msg.messageId)
      const originMsg = await this.#hop.get(hopKey)
      log.info(
        '[%s:h] MATCHED HOP IN origin=%s id=%s (subId=%s, block=%s #%s)',
        msg.chainId,
        originMsg.origin.chainId,
        hopKey,
        msg.subscriptionId,
        msg.blockHash,
        msg.blockNumber
      )
      // do not delete hop key because maybe hop stop outbound hasn't arrived yet
      // TO THINK: store in different keys?
      this.#onXcmHopIn(originMsg, msg)
    } catch {
      const hashKey = this.#matchingKey(msg.subscriptionId, msg.chainId, msg.messageHash)
      const idKey = this.#matchingKey(msg.subscriptionId, msg.chainId, msg.messageId)

      if (hashKey === idKey) {
        log.info(
          '[%s:i] STORED hash=%s (subId=%s, block=%s #%s)',
          msg.chainId,
          hashKey,
          msg.subscriptionId,
          msg.blockHash,
          msg.blockNumber
        )
        await this.#inbound.put(hashKey, msg)
        await this.#janitor.schedule({
          sublevel: prefixes.matching.inbound,
          key: hashKey,
        })
      } else {
        log.info(
          '[%s:i] STORED hash=%s id=%s (subId=%s, block=%s #%s)',
          msg.chainId,
          hashKey,
          idKey,
          msg.subscriptionId,
          msg.blockHash,
          msg.blockNumber
        )
        await this.#inbound.batch().put(idKey, msg).put(hashKey, msg).write()
        await this.#janitor.schedule(
          {
            sublevel: prefixes.matching.inbound,
            key: hashKey,
          },
          {
            sublevel: prefixes.matching.inbound,
            key: idKey,
          }
        )
      }
    }
  }

  async #tryMatchOnOutbound(msg: XcmSent, outboundTTL: number) {
    if (msg.messageId === undefined) {
      return
    }

    // Still we don't know if the inbound is upgraded,
    // i.e. if uses message ids
    const idKey = this.#matchingKey(msg.subscriptionId, msg.destination.chainId, msg.messageId)
    const hashKey = this.#matchingKey(msg.subscriptionId, msg.destination.chainId, msg.waypoint.messageHash)

    const log = this.#log
    try {
      const inMsg = await Promise.any([this.#inbound.get(idKey), this.#inbound.get(hashKey)])

      log.info(
        '[%s:o] MATCHED hash=%s id=%s (subId=%s, block=%s #%s)',
        msg.origin.chainId,
        hashKey,
        idKey,
        msg.subscriptionId,
        msg.origin.blockHash,
        msg.origin.blockNumber
      )
      await this.#inbound.batch().del(idKey).del(hashKey).write()
      this.#onXcmMatched(msg, inMsg)
    } catch {
      await this.#storekeysOnOutbound(msg, outboundTTL)
    }
  }

  // TODO: refactor to lower complexity
  async #storekeysOnOutbound(msg: XcmSent, outboundTTL: number) {
    const log = this.#log
    const sublegs = msg.legs.filter((l) => isOnSameConsensus(msg.waypoint.chainId, l.from))

    for (const [i, leg] of sublegs.entries()) {
      const stop = leg.to
      const hKey = this.#matchingKey(msg.subscriptionId, stop, msg.waypoint.messageHash)
      if (msg.messageId) {
        const iKey = this.#matchingKey(msg.subscriptionId, stop, msg.messageId)
        if (leg.type === 'bridge') {
          const bridgeOut = leg.from
          const bridgeIn = leg.to
          const bridgeOutIdKey = this.#matchingKey(msg.subscriptionId, bridgeOut, msg.messageId)
          const bridgeInIdKey = this.#matchingKey(msg.subscriptionId, bridgeIn, msg.messageId)
          log.info(
            '[%s:b] STORED out=%s outKey=%s in=%s inKey=%s (subId=%s, block=%s #%s)',
            msg.origin.chainId,
            bridgeOut,
            bridgeOutIdKey,
            bridgeIn,
            bridgeInIdKey,
            msg.subscriptionId,
            msg.origin.blockHash,
            msg.origin.blockNumber
          )
          await this.#bridge.batch().put(bridgeOutIdKey, msg).put(bridgeInIdKey, msg).write()
          await this.#janitor.schedule(
            {
              sublevel: prefixes.matching.bridge,
              key: bridgeOutIdKey,
              expiry: outboundTTL,
            },
            {
              sublevel: prefixes.matching.bridge,
              key: bridgeInIdKey,
              expiry: outboundTTL,
            }
          )
        } else if (i === sublegs.length - 1 || leg.relay !== undefined) {
          log.info(
            '[%s:o] STORED dest=%s hash=%s id=%s (subId=%s, block=%s #%s)',
            msg.origin.chainId,
            stop,
            hKey,
            iKey,
            msg.subscriptionId,
            msg.origin.blockHash,
            msg.origin.blockNumber
          )
          await this.#outbound.batch().put(iKey, msg).put(hKey, msg).write()
          await this.#janitor.schedule(
            {
              sublevel: prefixes.matching.outbound,
              key: hKey,
              expiry: outboundTTL,
            },
            {
              sublevel: prefixes.matching.outbound,
              key: iKey,
              expiry: outboundTTL,
            }
          )
        } else if (leg.type === 'hop') {
          log.info(
            '[%s:h] STORED stop=%s hash=%s id=%s (subId=%s, block=%s #%s)',
            msg.origin.chainId,
            stop,
            hKey,
            iKey,
            msg.subscriptionId,
            msg.origin.blockHash,
            msg.origin.blockNumber
          )
          await this.#hop.batch().put(iKey, msg).put(hKey, msg).write()
          await this.#janitor.schedule(
            {
              sublevel: prefixes.matching.hop,
              key: hKey,
              expiry: outboundTTL,
            },
            {
              sublevel: prefixes.matching.hop,
              key: iKey,
              expiry: outboundTTL,
            }
          )
        }
      } else if (i === sublegs.length - 1 || leg.relay !== undefined) {
        log.info(
          '[%s:o] STORED dest=%s hash=%s (subId=%s, block=%s #%s)',
          msg.origin.chainId,
          stop,
          hKey,
          msg.subscriptionId,
          msg.origin.blockHash,
          msg.origin.blockNumber
        )
        await this.#outbound.put(hKey, msg)
        await this.#janitor.schedule({
          sublevel: prefixes.matching.outbound,
          key: hKey,
          expiry: outboundTTL,
        })
      } else if (leg.type === 'hop') {
        log.info(
          '[%s:h] STORED stop=%s hash=%s(subId=%s, block=%s #%s)',
          msg.origin.chainId,
          stop,
          hKey,
          msg.subscriptionId,
          msg.origin.blockHash,
          msg.origin.blockNumber
        )
        await this.#hop.put(hKey, msg)
        await this.#janitor.schedule({
          sublevel: prefixes.matching.hop,
          key: hKey,
          expiry: outboundTTL,
        })
      }
    }
  }

  async #findRelayInbound(outMsg: XcmSent) {
    const log = this.#log
    const relayKey = outMsg.messageId
      ? this.#matchingKey(outMsg.subscriptionId, outMsg.origin.chainId, outMsg.messageId)
      : this.#matchingKey(outMsg.subscriptionId, outMsg.origin.chainId, outMsg.waypoint.messageHash)

    try {
      const relayMsg = await this.#relay.get(relayKey)
      log.info(
        '[%s:r] RELAYED key=%s (subId=%s, block=%s #%s)',
        outMsg.origin.chainId,
        relayKey,
        outMsg.subscriptionId,
        outMsg.origin.blockHash,
        outMsg.origin.blockNumber
      )
      await this.#relay.del(relayKey)
      await this.#onXcmRelayed(outMsg, relayMsg)
    } catch {
      // noop, it's possible that there are no relay subscriptions for an origin.
    }
  }

  async stop() {
    await this.#mutex.waitForUnlock()
  }

  /**
   * Clears the pending states for a subcription.
   *
   * @param subscriptionId The subscription id.
   */
  async clearPendingStates(subscriptionId: string) {
    const prefix = subscriptionId + ':'
    await this.#clearByPrefix(this.#inbound, prefix)
    await this.#clearByPrefix(this.#outbound, prefix)
    await this.#clearByPrefix(this.#relay, prefix)
    await this.#clearByPrefix(this.#hop, prefix)
  }

  async #clearByPrefix(sublevel: SubLevel<any>, prefix: string) {
    try {
      const batch = sublevel.batch()
      for await (const key of sublevel.keys({ gt: prefix })) {
        if (key.startsWith(prefix)) {
          batch.del(key)
        } else {
          break
        }
      }
      await batch.write()
    } catch (error) {
      this.#log.error(error, 'while clearing prefix %s', prefix)
    }
  }

  #matchingKey(subscriptionId: string, chainId: string, messageId: string) {
    // We add the subscription id as a discriminator
    // to allow multiple subscriptions to the same messages
    return `${subscriptionId}:${messageId}:${chainId}`
  }

  #onXcmOutbound(outMsg: XcmSent) {
    this.emit('telemetryXcmOutbound', outMsg)

    try {
      this.#xcmMatchedReceiver(outMsg)
    } catch (e) {
      this.#log.error(e, 'Error on notification')
    }
  }

  #onXcmMatched(outMsg: XcmSent, inMsg: XcmInbound) {
    this.emit('telemetryXcmMatched', inMsg, outMsg)
    if (inMsg.assetsTrapped !== undefined) {
      this.emit('telemetryXcmTrapped', inMsg, outMsg)
    }

    try {
      const message: XcmReceived = new GenericXcmReceived(outMsg, inMsg)
      this.#xcmMatchedReceiver(message)
    } catch (e) {
      this.#log.error(e, 'Error on notification')
    }
  }

  #onXcmRelayed(outMsg: XcmSent, relayMsg: XcmRelayedWithContext) {
    const message: XcmRelayed = new GenericXcmRelayed(outMsg, relayMsg)
    this.emit('telemetryXcmRelayed', message)

    try {
      this.#xcmMatchedReceiver(message)
    } catch (e) {
      this.#log.error(e, 'Error on notification')
    }
  }

  #onXcmHopOut(originMsg: XcmSent, hopMsg: XcmSent) {
    try {
      const { chainId, blockHash, blockNumber, event, outcome, error } = hopMsg.origin
      const { instructions, messageData, messageHash, assetsTrapped } = hopMsg.waypoint
      const currentLeg = hopMsg.legs[0]
      const legIndex = originMsg.legs.findIndex((l) => l.from === currentLeg.from && l.to === currentLeg.to)
      const waypointContext: XcmWaypointContext = {
        legIndex,
        chainId,
        blockHash,
        blockNumber,
        event,
        outcome,
        error,
        messageData,
        messageHash,
        instructions,
        assetsTrapped,
      }
      const message: XcmHop = new GenericXcmHop(originMsg, waypointContext, 'out')

      this.emit('telemetryXcmHop', message)

      this.#xcmMatchedReceiver(message)
    } catch (e) {
      this.#log.error(e, 'Error on notification')
    }
  }

  // NOTE: message data, hash and instructions are right for hop messages with 1 intermediate stop
  // but will be wrong on the second or later hops for XCM with > 2 intermediate stops
  // since we are not storing messages or contexts of intermediate hops
  #onXcmHopIn(originMsg: XcmSent, hopMsg: XcmInbound) {
    if (hopMsg.assetsTrapped !== undefined) {
      this.emit('telemetryXcmTrapped', hopMsg, originMsg)
    }

    try {
      const { chainId, blockHash, blockNumber, event, outcome, error, assetsTrapped } = hopMsg
      const { messageData, messageHash, instructions } = originMsg.waypoint
      const legIndex = originMsg.legs.findIndex((l) => l.to === chainId)
      const waypointContext: XcmWaypointContext = {
        legIndex,
        chainId,
        blockHash,
        blockNumber,
        event,
        outcome,
        error,
        messageData,
        messageHash,
        instructions,
        assetsTrapped,
      }
      const message: XcmHop = new GenericXcmHop(originMsg, waypointContext, 'in')

      this.emit('telemetryXcmHop', message)

      this.#xcmMatchedReceiver(message)
    } catch (e) {
      this.#log.error(e, 'Error on notification')
    }
  }

  #onXcmBridgeAccepted(bridgeAcceptedMsg: XcmBridge) {
    this.emit('telemetryXcmBridge', bridgeAcceptedMsg)
    try {
      this.#xcmMatchedReceiver(bridgeAcceptedMsg)
    } catch (e) {
      this.#log.error(e, 'Error on notification')
    }
  }

  #onXcmBridgeDelivered(bridgeDeliveredMsg: XcmBridge) {
    this.emit('telemetryXcmBridge', bridgeDeliveredMsg)
    try {
      this.#xcmMatchedReceiver(bridgeDeliveredMsg)
    } catch (e) {
      this.#log.error(e, 'Error on notification')
    }
  }

  #onXcmBridgeMatched(bridgeOutMsg: XcmBridge, bridgeInMsg: XcmBridgeInboundWithContext) {
    try {
      const { chainId, blockHash, blockNumber, event, outcome, error, bridgeKey } = bridgeInMsg
      const { messageData, messageHash, instructions } = bridgeOutMsg.waypoint
      const legIndex = bridgeOutMsg.legs.findIndex((l) => l.to === chainId && l.type === 'bridge')
      const waypointContext: XcmWaypointContext = {
        legIndex,
        chainId,
        blockHash,
        blockNumber: blockNumber.toString(),
        event,
        messageData,
        messageHash,
        instructions,
        outcome,
        error,
      }
      const bridgeMatched: XcmBridge = new GenericXcmBridge(bridgeOutMsg, waypointContext, {
        bridgeMessageType: 'received',
        bridgeKey,
        forwardId: bridgeOutMsg.forwardId,
      })

      this.emit('telemetryXcmBridge', bridgeMatched)

      this.#xcmMatchedReceiver(bridgeMatched)
    } catch (e) {
      this.#log.error(e, 'Error on notification')
    }
  }

  #onXcmSwept(task: JanitorTask, msg: string) {
    try {
      if (task.sublevel === prefixes.matching.outbound) {
        const outMsg = JSON.parse(msg) as XcmSent
        const message: XcmTimeout = new GenericXcmTimeout(outMsg)
        this.#log.debug('TIMEOUT on key %s', task.key)
        this.emit('telemetryXcmTimeout', message)
        this.#xcmMatchedReceiver(message)
      }
    } catch (e) {
      this.#log.error(e, 'Error on notification')
    }
  }
}
