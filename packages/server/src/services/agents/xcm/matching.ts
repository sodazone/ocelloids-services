import EventEmitter from 'node:events'

import { Mutex } from 'async-mutex'
import { safeDestr } from 'destr'

import { AgentRuntimeContext } from '@/services/agents/types.js'
import { getRelayId, isOnSameConsensus } from '@/services/config.js'
import { Janitor, JanitorTask } from '@/services/scheduling/janitor.js'
import { Logger, SubLevel, jsonEncoded } from '@/services/types.js'

import { HexString } from '@/lib.js'
import { TelemetryXcmEventEmitter } from './telemetry/events.js'
import {
  GenericXcmBridge,
  GenericXcmHop,
  GenericXcmReceived,
  GenericXcmRelayed,
  GenericXcmTimeout,
  Leg,
  MessageHashData,
  XcmBridge,
  XcmBridgeAcceptedWithContext,
  XcmBridgeDeliveredWithContext,
  XcmBridgeInboundWithContext,
  XcmHop,
  XcmInbound,
  XcmJourney,
  XcmMessagePayload,
  XcmReceived,
  XcmRelayed,
  XcmRelayedWithContext,
  XcmSent,
  XcmTimeout,
  XcmWaypointContext,
  prefixes,
} from './types/index.js'

const DEFAULT_TIMEOUT = 10 * 60000

export type XcmMatchedReceiver = (payload: XcmMessagePayload) => Promise<void> | void

export type ChainBlock = {
  chainId: string
  blockHash: string
  blockNumber: string
}

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }
type XcmSentWithId = WithRequired<XcmSent, 'messageId'>

export function matchingKey(chainId: string, messageId: string) {
  return `${chainId}:${messageId}`
}

function matchingRange(chainId: string) {
  return {
    gt: matchingKey(chainId, '0'),
    lt: matchingKey(chainId, '1'),
  }
}

function hasTopicId(hashKey: string, idKey?: string) {
  return hashKey !== idKey
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}
const MAX_MATCH_RETRIES = 5

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
export class MatchingEngine extends (EventEmitter as new () => TelemetryXcmEventEmitter) {
  readonly #log: Logger
  readonly #janitor: Janitor

  readonly #outbound: SubLevel<XcmSent>
  readonly #inbound: SubLevel<XcmInbound>
  readonly #relay: SubLevel<XcmRelayedWithContext>
  readonly #hop: SubLevel<XcmSent>
  readonly #bridge: SubLevel<XcmSent>
  readonly #bridgeAccepted: SubLevel<XcmBridge>
  readonly #bridgeInbound: SubLevel<XcmBridgeInboundWithContext>
  readonly #messageData: SubLevel<HexString>
  readonly #mutex: Mutex
  readonly #xcmMatchedReceiver: XcmMatchedReceiver
  readonly #expiry: number

  constructor({ log, db, janitor }: AgentRuntimeContext, xcmMatchedReceiver: XcmMatchedReceiver) {
    super()

    this.#log = log
    this.#janitor = janitor
    this.#mutex = new Mutex()
    this.#xcmMatchedReceiver = xcmMatchedReceiver

    // Key format: [destination-chain-id]:[message-id/hash]
    this.#outbound = db.sublevel<string, XcmSent>(prefixes.matching.outbound, jsonEncoded)

    // [current-chain-id]:[message-id/hash]
    this.#inbound = db.sublevel<string, XcmInbound>(prefixes.matching.inbound, jsonEncoded)

    // [relay-outbound-chain-id]:[message-id/hash]
    this.#relay = db.sublevel<string, XcmRelayedWithContext>(prefixes.matching.relay, jsonEncoded)

    // [hop-stop-chain-id]:[message-id/hash]
    this.#hop = db.sublevel<string, XcmSent>(prefixes.matching.hop, jsonEncoded)

    // [bridge-chain-id]:[message-id]
    this.#bridge = db.sublevel<string, XcmSent>(prefixes.matching.bridge, jsonEncoded)

    // [bridge-key]
    this.#bridgeAccepted = db.sublevel<string, XcmBridge>(prefixes.matching.bridgeAccepted, jsonEncoded)

    // [bridge-key]
    this.#bridgeInbound = db.sublevel<string, XcmBridgeInboundWithContext>(
      prefixes.matching.bridgeIn,
      jsonEncoded,
    )

    this.#messageData = db.sublevel<string, HexString>(prefixes.matching.messageData, {})

    this.#expiry = DEFAULT_TIMEOUT
    this.#janitor.on('sweep', this.#onXcmSwept.bind(this))
  }

  async onMessageData({ hash, data, topicId }: MessageHashData) {
    await this.#mutex.runExclusive(async () => {
      this.#log.info('[matching] STORE HASH DATA hash=%s', hash)
      const batch = this.#messageData.batch().put(hash, data)
      if (topicId) {
        this.#log.info('[matching] STORE HASH DATA topicId=%s', topicId)
        batch.put(topicId, data)
      }
      await batch.write()
      await new Promise((res) => setImmediate(res)) // allow event loop tick
      await this.#janitor.schedule({
        sublevel: prefixes.matching.messageData,
        key: hash,
        expiry: 600_000,
      })
      if (topicId) {
        await this.#janitor.schedule({
          sublevel: prefixes.matching.messageData,
          key: topicId,
          expiry: 600_000,
        })
      }
    })
  }

  async onOutboundMessage(outMsg: XcmSent) {
    // Confirmation key at destination
    await this.#mutex.runExclusive(async () => {
      const hashKey = matchingKey(outMsg.destination.chainId, outMsg.waypoint.messageHash)
      // check first if there is already an outbound msg stored with the same key
      if (await this.#isOutboundDuplicate(hashKey)) {
        return outMsg
      }

      if (outMsg.forwardId !== undefined) {
        // Is bridged message
        // Try to match origin message (on other consensus) using the forward ID.
        // If found, create outbound message with origin context and current waypoint context
        // before trying to match inbound (on same consensus).
        // If origin message not found, treat as normal XCM outbound

        const {
          origin: { chainId },
          messageId,
          forwardId,
          waypoint,
        } = outMsg
        const forwardIdKey = matchingKey(chainId, forwardId)
        const originMsg = await this.#bridge.get(forwardIdKey)
        if (originMsg !== undefined) {
          const bridgedSent: XcmSent = {
            ...originMsg,
            waypoint,
            messageId,
            forwardId,
          }
          await this.#handleXcmOutbound(bridgedSent)
          await this.#bridge.del(forwardIdKey)
        } else {
          await this.#handleXcmOutbound(outMsg)
        }
      } else if (outMsg.messageId) {
        // Is not bridged message
        // First try to match by hop key
        // If found, emit hop, and do not store anything
        // If no matching hop key, assume is origin outbound message -> try to match inbound
        // We assume that the original origin message is ALWAYS received first.
        // NOTE: hops can only use idKey since message hash will be different on each hop

        const hopKey = matchingKey(outMsg.origin.chainId, outMsg.messageId)
        const originMsg = await this.#hop.get(hopKey)
        if (originMsg !== undefined) {
          await this.#findRelayInbound(outMsg, originMsg)

          this.#log.info(
            '[%s:h] MATCHED HOP OUT origin=%s id=%s (block=%s #%s)',
            outMsg.origin.chainId,
            originMsg.origin.chainId,
            hopKey,
            outMsg.origin.blockHash,
            outMsg.origin.blockNumber,
          )
          // do not delete hop key because maybe hop stop inbound hasn't arrived yet
          this.#onXcmHopOut(originMsg, outMsg)
        } else {
          await this.#handleXcmOutbound(outMsg)
        }
      } else {
        await this.#handleXcmOutbound(outMsg)
      }
    })

    return outMsg
  }

  async onInboundMessage(inMsg: XcmInbound) {
    await this.#mutex.runExclusive(async () => {
      await this.#enhanceInboundWithMessageData(inMsg)
      const hashKey = matchingKey(inMsg.chainId, inMsg.messageHash)
      const idKey = matchingKey(inMsg.chainId, inMsg.messageId ?? 'unknown')

      if (hasTopicId(hashKey, idKey)) {
        try {
          // 1.1. Try to match any hops
          await this.#tryHopMatchOnInboundWithRetries(inMsg)
        } catch {
          // 1.2. Try to match outbounds
          const outMsg = await Promise.any([this.#outbound.get(idKey), this.#outbound.get(hashKey)])
          if (outMsg !== undefined) {
            // Reconstruct hashKey with outbound message hash in case of hopped messages
            const recHashKey = matchingKey(inMsg.chainId, outMsg.waypoint.messageHash)
            this.#log.info(
              '[%s:i] MATCHED hash=%s id=%s rec=%s (block=%s #%s)',
              inMsg.chainId,
              hashKey,
              idKey,
              recHashKey,
              inMsg.blockHash,
              inMsg.blockNumber,
            )
            const legIndex = outMsg.legs.findIndex((l) => l.to === inMsg.chainId)
            if (legIndex === outMsg.legs.length - 1) {
              await this.#deleteMatchedKeys(outMsg)
            }
            this.#onXcmMatched(outMsg, inMsg)
          } else {
            // 1.3. If no matches, store inbound
            await this.#storeXcmInbound(inMsg)
          }
        }
      } else {
        try {
          await this.#tryHopMatchOnInboundWithRetries(inMsg)
        } catch {
          const outMsg = await this.#outbound.get(hashKey)
          if (outMsg !== undefined) {
            this.#log.info(
              '[%s:i] MATCHED hash=%s (block=%s #%s)',
              inMsg.chainId,
              hashKey,
              inMsg.blockHash,
              inMsg.blockNumber,
            )

            const legIndex = outMsg.legs.findIndex((l) => l.to === inMsg.chainId)
            if (legIndex === outMsg.legs.length - 1) {
              await this.#deleteMatchedKeys(outMsg)
            }
            this.#onXcmMatched(outMsg, inMsg)
          } else {
            await this.#storeXcmInbound(inMsg)
          }
        }
      }
    })
  }

  async onRelayedMessage(relayMsg: XcmRelayedWithContext) {
    const relayId = getRelayId(relayMsg.origin)
    const idKey = relayMsg.messageId
      ? matchingKey(relayMsg.recipient, relayMsg.messageId)
      : matchingKey(relayMsg.recipient, relayMsg.messageHash)

    await this.#mutex.runExclusive(async () => {
      // Hop relay matching heuristic :_
      for await (const originMsg of this.#outbound.values(matchingRange(relayMsg.recipient))) {
        if (
          originMsg.legs.find(({ partialMessage }) =>
            this.#partialMatched(partialMessage, relayMsg.messageData),
          ) !== undefined
        ) {
          this.#log.info(
            '[%s:r] RELAYED HOP origin=%s recipient=%s (block=%s #%s)',
            relayId,
            originMsg.origin.chainId,
            relayMsg.recipient,
            relayMsg.blockHash,
            relayMsg.blockNumber,
          )
          this.#onXcmRelayed(originMsg, relayMsg)
          return
        }
      }
      const outMsg = await this.#outbound.get(idKey)
      if (outMsg !== undefined) {
        this.#log.info(
          '[%s:r] RELAYED origin=%s recipient=%s (block=%s #%s)',
          relayId,
          relayMsg.origin,
          relayMsg.recipient,
          relayMsg.blockHash,
          relayMsg.blockNumber,
        )
        await this.#relay.del(idKey)
        await this.#onXcmRelayed(outMsg, relayMsg)
      } else {
        const relayKey = relayMsg.messageId
          ? matchingKey(relayMsg.origin, relayMsg.messageId)
          : matchingKey(relayMsg.origin, relayMsg.messageHash)
        this.#log.info(
          '[%s:r] STORED relayKey=%s origin=%s recipient=%s (block=%s #%s)',
          relayId,
          relayKey,
          relayMsg.origin,
          relayMsg.recipient,
          relayMsg.blockHash,
          relayMsg.blockNumber,
        )
        await this.#relay.put(relayKey, relayMsg)
        await new Promise((res) => setImmediate(res)) // allow event loop tick
        await this.#janitor.schedule({
          sublevel: prefixes.matching.relay,
          key: relayKey,
        })
      }
    })
  }

  async onBridgeOutboundAccepted(msg: XcmBridgeAcceptedWithContext) {
    await this.#mutex.runExclusive(async () => {
      if (msg.forwardId === undefined) {
        this.#log.error(
          '[%s] forward_id_to not found for bridge accepted message (block=%s #%s)',
          msg.chainId,
          msg.blockHash,
          msg.blockNumber,
        )
        return
      }
      const { chainId, forwardId, bridgeKey } = msg
      const idKey = matchingKey(chainId, forwardId)

      const originMsg = await this.#bridge.get(idKey)
      if (originMsg !== undefined) {
        const {
          blockHash,
          blockNumber,
          event,
          messageData,
          instructions,
          messageHash,
          specVersion,
          timestamp,
        } = msg
        const legIndex = originMsg.legs.findIndex((l) => l.from === chainId && l.type === 'bridge')
        const waypointContext: XcmWaypointContext = {
          legIndex,
          chainId,
          blockHash,
          specVersion,
          timestamp,
          blockNumber: blockNumber.toString(),
          event,
          messageData,
          messageHash,
          instructions,
          outcome: 'Success', // always 'Success' since it's delivered
          error: null,
        }
        const bridgeOutMsg: XcmBridge = new GenericXcmBridge(
          originMsg as unknown as XcmBridge,
          waypointContext,
          {
            bridgeMessageType: 'accepted',
            bridgeKey,
            forwardId,
          },
        )
        const sublevelBridgeKey = `${bridgeKey}`
        await this.#bridgeAccepted.put(sublevelBridgeKey, bridgeOutMsg)
        await new Promise((res) => setImmediate(res)) // allow event loop tick
        await this.#janitor.schedule({
          sublevel: prefixes.matching.bridgeAccepted,
          key: sublevelBridgeKey,
        })
        this.#log.info(
          '[%s:ba] BRIDGE MESSAGE ACCEPTED key=%s (block=%s #%s)',
          chainId,
          sublevelBridgeKey,
          msg.blockHash,
          msg.blockNumber,
        )
        this.#onXcmBridgeAccepted(bridgeOutMsg)
      } else {
        this.#log.warn(
          '[%s:ba] ORIGIN MSG NOT FOUND id=%s (block=%s #%s)',
          chainId,
          idKey,
          msg.blockHash,
          msg.blockNumber,
        )
      }
    })
  }

  async onBridgeOutboundDelivered(msg: XcmBridgeDeliveredWithContext) {
    await this.#mutex.runExclusive(async () => {
      const { chainId, bridgeKey } = msg
      const sublevelBridgeKey = `${bridgeKey}`

      const bridgeOutMsg = await this.#bridgeAccepted.get(sublevelBridgeKey)
      if (bridgeOutMsg !== undefined) {
        const bridgeInMsg = await this.#bridgeInbound.get(sublevelBridgeKey)
        if (bridgeInMsg !== undefined) {
          this.#log.info(
            '[%s:bd] BRIDGE MATCHED key=%s (block=%s #%s)',
            chainId,
            sublevelBridgeKey,
            msg.blockHash,
            msg.blockNumber,
          )
          await this.#bridgeInbound.del(sublevelBridgeKey)
          await this.#bridgeAccepted.del(sublevelBridgeKey)
          this.#onXcmBridgeDelivered({ ...bridgeOutMsg, bridgeMessageType: 'delivered' })
          this.#onXcmBridgeMatched(bridgeOutMsg, bridgeInMsg)
        } else {
          this.#log.info(
            '[%s:bo] BRIDGE DELIVERED key=%s (block=%s #%s)',
            chainId,
            sublevelBridgeKey,
            msg.blockHash,
            msg.blockNumber,
          )
          this.#onXcmBridgeDelivered(bridgeOutMsg)
        }
      } else {
        this.#log.warn(
          '[%s:bd] BRIDGE ACCEPTED MSG NOT FOUND key=%s (block=%s #%s)',
          chainId,
          sublevelBridgeKey,
          msg.blockHash,
          msg.blockNumber,
        )
      }
    })
  }

  async onBridgeInbound(bridgeInMsg: XcmBridgeInboundWithContext) {
    await this.#mutex.runExclusive(async () => {
      const { chainId, bridgeKey } = bridgeInMsg
      const sublevelBridgeKey = `${bridgeKey}`

      const bridgeOutMsg = await this.#bridgeAccepted.get(sublevelBridgeKey)
      if (bridgeOutMsg !== undefined) {
        this.#log.info(
          '[%s:bi] BRIDGE MATCHED key=%s (block=%s #%s)',
          chainId,
          sublevelBridgeKey,
          bridgeInMsg.blockHash,
          bridgeInMsg.blockNumber,
        )
        await this.#bridgeAccepted.del(sublevelBridgeKey)
        this.#onXcmBridgeMatched(bridgeOutMsg, bridgeInMsg)
      } else {
        this.#log.info(
          '[%s:bi] BRIDGE IN STORED id=%s (block=%s #%s)',
          chainId,
          sublevelBridgeKey,
          bridgeInMsg.blockHash,
          bridgeInMsg.blockNumber,
        )
        this.#bridgeInbound.put(sublevelBridgeKey, bridgeInMsg)
        await new Promise((res) => setImmediate(res)) // allow event loop tick
        await this.#janitor.schedule({
          sublevel: prefixes.matching.bridgeIn,
          key: sublevelBridgeKey,
        })
      }
    })
  }

  async #isOutboundDuplicate(hashKey: string) {
    const existing = await this.#outbound.get(hashKey)
    if (existing !== undefined) {
      this.#log.debug(
        '[%s:o] DUPLICATE outbound dropped hash=%s (block=%s #%s)',
        existing.origin.chainId,
        hashKey,
        existing.origin.blockHash,
        existing.origin.blockNumber,
      )
      return true
    } else {
      return false
    }
  }

  async stop() {
    this.#log.info('[matching] stop')
    await this.#mutex.waitForUnlock()
  }

  // try to find in DB by hop key
  // if found, emit hop, and do not store anything
  // if no matching hop key, assume is destination inbound and store.
  // We assume that the original origin message is ALWAYS received first.
  // NOTE: hops can only use idKey since message hash will be different on each hop
  async #tryHopMatchOnInbound(msg: XcmInbound) {
    const hopKey = matchingKey(msg.chainId, msg.messageId ?? msg.messageHash)
    const originMsg = await this.#hop.get(hopKey)
    if (originMsg !== undefined) {
      this.#log.info(
        '[%s:h] MATCHED HOP IN origin=%s id=%s (block=%s #%s)',
        msg.chainId,
        originMsg.origin.chainId,
        hopKey,
        msg.blockHash,
        msg.blockNumber,
      )
      // do not delete hop key because maybe hop stop outbound hasn't arrived yet
      // TO THINK: store in different keys?
      this.#onXcmHopIn(originMsg, msg)
    } else {
      // Try to match inbound msg as final destination receive in case of multi-hop xcms
      // Hop matching heuristic :_
      for await (const originMsg of this.#outbound.values(matchingRange(msg.chainId))) {
        if (
          originMsg.legs.find(({ partialMessage }) =>
            this.#partialMatched(partialMessage, msg.messageData),
          ) !== undefined
        ) {
          // Matched outbound by heuristic
          // Need to clean up outbound keys to not trigger timeout
          this.#log.info(
            '[%s:i] MATCHED BY HEURISTIC origin=%s (block=%s #%s)',
            msg.chainId,
            originMsg.origin.chainId,
            msg.blockHash,
            msg.blockNumber,
          )
          const legIndex = originMsg.legs.findIndex((l) => l.to === msg.chainId)
          if (legIndex === originMsg.legs.length - 1) {
            await this.#deleteMatchedKeys(originMsg)
            this.#onXcmMatched(originMsg, msg)
          } else {
            const legType = originMsg.legs[legIndex].type
            if (legType === 'hop') {
              this.#onXcmHopIn(originMsg, msg)
            }
          }

          return
        }
      }

      throw new Error('No matching hops')
    }
  }

  async #deleteMatchedKeys(originMsg: XcmSent) {
    const batch = this.#outbound.batch()
    for (const leg of originMsg.legs) {
      const stop = leg.to
      batch.del(matchingKey(stop, originMsg.waypoint.messageHash))
      if (originMsg.messageId) {
        batch.del(matchingKey(stop, originMsg.messageId))
      }
    }
    await batch.write()
  }

  async #storeXcmInbound(msg: XcmInbound) {
    const hashKey = matchingKey(msg.chainId, msg.messageHash)
    const idKey = matchingKey(msg.chainId, msg.messageId ?? 'unknown')

    if (hasTopicId(hashKey, idKey)) {
      this.#log.info(
        '[%s:i] STORED hash=%s id=%s (block=%s #%s)',
        msg.chainId,
        hashKey,
        idKey,
        msg.blockHash,
        msg.blockNumber,
      )
      await this.#inbound.batch().put(idKey, msg).put(hashKey, msg).write()
      await new Promise((res) => setImmediate(res)) // allow event loop tick
      await this.#janitor.schedule(
        {
          sublevel: prefixes.matching.inbound,
          key: hashKey,
        },
        {
          sublevel: prefixes.matching.inbound,
          key: idKey,
        },
      )
    } else {
      this.#log.info(
        '[%s:i] STORED hash=%s (block=%s #%s)',
        msg.chainId,
        hashKey,
        msg.blockHash,
        msg.blockNumber,
      )
      await this.#inbound.put(hashKey, msg)
      await new Promise((res) => setImmediate(res)) // allow event loop tick
      await this.#janitor.schedule({
        sublevel: prefixes.matching.inbound,
        key: hashKey,
      })
    }
  }

  // Try to get stored inbound messages and notify if any
  // If inbound messages are found, clean up outbound.
  // If not found, store outbound message in #outbound to match destination inbound
  // and #hop to match hop outbounds and inbounds.
  // Note: if relay messages arrive after outbound and inbound, it will not match.
  async #handleXcmOutbound(msg: XcmSent) {
    // Hop matching heuristic :_
    for await (const originMsg of this.#hop.values(matchingRange(msg.origin.chainId))) {
      if (
        originMsg.legs.find(({ partialMessage }) =>
          this.#partialMatched(partialMessage, msg.waypoint.messageData),
        ) !== undefined
      ) {
        await this.#findRelayInbound(msg, originMsg)

        this.#log.info(
          '[%s:h] MATCHED HOP OUT BY HEURISTIC origin=%s (block=%s #%s)',
          msg.waypoint.chainId,
          originMsg.origin.chainId,
          msg.waypoint.blockHash,
          msg.waypoint.blockNumber,
        )
        this.#onXcmHopOut(originMsg, msg)
        return
      }
    }

    // Emit outbound notification
    this.#log.info(
      '[%s:o] OUT origin=%s destination=%s (block=%s #%s)',
      msg.waypoint.chainId,
      msg.origin.chainId,
      msg.destination.chainId,
      msg.waypoint.blockHash,
      msg.waypoint.blockNumber,
    )
    this.#onXcmOutbound(msg)

    await this.#findRelayInbound(msg)

    try {
      await this.#tryMatchWithDelayedRetries(
        {
          hash: matchingKey(msg.destination.chainId, msg.waypoint.messageHash),
          id: msg.messageId ? matchingKey(msg.destination.chainId, msg.messageId) : undefined,
        },
        msg,
      )
    } catch {
      await this.#storeOnOutbound(msg)
    }
  }

  async #tryMatchOnOutbound(keys: { hash: string; id?: string }, msg: XcmJourney, isHop = false) {
    if (keys.id === undefined) {
      const inMsg = await this.#inbound.get(keys.hash)
      if (inMsg === undefined) {
        throw new Error('Inbound message not found.')
      }
      this.#log.info(
        isHop ? '[%s:o] MATCHED HOP IN hash=%s (block=%s #%s)' : '[%s:o] MATCHED hash=%s (block=%s #%s)',
        msg.origin.chainId,
        keys.hash,
        msg.origin.blockHash,
        msg.origin.blockNumber,
      )
      await this.#inbound.del(keys.hash)
      if (isHop) {
        this.#onXcmHopIn(msg as XcmSent, inMsg)
      } else {
        this.#onXcmMatched(msg as XcmSent, inMsg)
      }
    } else {
      // Still we don't know if the inbound is upgraded, so get both id and hash keys
      // i.e. if uses message ids
      const inMsg = await Promise.any([this.#inbound.get(keys.id), this.#inbound.get(keys.hash)])

      if (inMsg === undefined) {
        throw new Error('Inbound message not found.')
      }

      this.#log.info(
        isHop
          ? '[%s:o] MATCHED HOP IN hash=%s id=%s (block=%s #%s)'
          : '[%s:o] MATCHED hash=%s id=%s (block=%s #%s)',
        msg.origin.chainId,
        keys.hash,
        keys.id,
        msg.origin.blockHash,
        msg.origin.blockNumber,
      )
      await this.#inbound.batch().del(keys.id).del(keys.hash).write()
      if (isHop) {
        this.#onXcmHopIn(msg as XcmSent, inMsg)
      } else {
        this.#onXcmMatched(msg as XcmSent, inMsg)
      }
    }
  }

  async #storeOnOutbound(msg: XcmSent) {
    const sublegs = msg.legs.filter((l) => isOnSameConsensus(msg.waypoint.chainId, l.from))

    for (const leg of sublegs) {
      if (msg.messageId === undefined || msg.messageId === msg.waypoint.messageHash) {
        await this.#storeLegOnOutboundWithHash(msg, leg)
      } else {
        await this.#storeLegOnOutboundWithTopicId(msg as XcmSentWithId, leg)
      }
    }
  }

  async #storeLegOnOutboundWithTopicId(msg: XcmSentWithId, leg: Leg) {
    const stop = leg.to
    const hKey = matchingKey(stop, msg.waypoint.messageHash)
    const iKey = matchingKey(stop, msg.messageId)

    if (leg.type === 'bridge') {
      const bridgeOut = leg.from
      const bridgeIn = leg.to
      const bridgeOutIdKey = matchingKey(bridgeOut, msg.messageId)
      const bridgeInIdKey = matchingKey(bridgeIn, msg.messageId)
      this.#log.info(
        '[%s:b] STORED out=%s outKey=%s in=%s inKey=%s (block=%s #%s)',
        msg.origin.chainId,
        bridgeOut,
        bridgeOutIdKey,
        bridgeIn,
        bridgeInIdKey,
        msg.origin.blockHash,
        msg.origin.blockNumber,
      )
      await this.#bridge.batch().put(bridgeOutIdKey, msg).put(bridgeInIdKey, msg).write()
      await new Promise((res) => setImmediate(res)) // allow event loop tick
      await this.#janitor.schedule(
        {
          sublevel: prefixes.matching.bridge,
          key: bridgeOutIdKey,
          expiry: this.#expiry,
        },
        {
          sublevel: prefixes.matching.bridge,
          key: bridgeInIdKey,
          expiry: this.#expiry,
        },
      )
      return
    }

    if (leg.type === 'hop') {
      try {
        await this.#tryMatchOnOutbound(
          {
            hash: hKey,
            id: iKey,
          },
          msg,
          true,
        )
      } catch (_e) {
        //
      }
      this.#log.info(
        '[%s:h] STORED stop=%s hash=%s id=%s (block=%s #%s)',
        msg.origin.chainId,
        stop,
        hKey,
        iKey,
        msg.origin.blockHash,
        msg.origin.blockNumber,
      )
      await this.#putHops([iKey, msg], [hKey, msg])
    }

    if (leg.relay !== undefined || leg.type === 'vmp') {
      this.#log.info(
        '[%s:o] STORED dest=%s hash=%s id=%s (block=%s #%s)',
        msg.origin.chainId,
        stop,
        hKey,
        iKey,
        msg.origin.blockHash,
        msg.origin.blockNumber,
      )
      await this.#outbound.batch().put(iKey, msg).put(hKey, msg).write()
      await new Promise((res) => setImmediate(res)) // allow event loop tick
      await this.#janitor.schedule(
        {
          sublevel: prefixes.matching.outbound,
          key: hKey,
          expiry: this.#expiry,
        },
        {
          sublevel: prefixes.matching.outbound,
          key: iKey,
          expiry: this.#expiry,
        },
      )
    }
  }

  async #storeLegOnOutboundWithHash(msg: XcmSent, leg: Leg) {
    const stop = leg.to
    const hKey = matchingKey(stop, msg.waypoint.messageHash)

    if (leg.type === 'hop') {
      try {
        await this.#tryMatchOnOutbound(
          {
            hash: hKey,
          },
          msg,
          true,
        )
      } catch (_e) {
        //
      }
      this.#log.info(
        '[%s:h] STORED stop=%s hash=%s (block=%s #%s)',
        msg.origin.chainId,
        stop,
        hKey,
        msg.origin.blockHash,
        msg.origin.blockNumber,
      )
      await this.#putHops([hKey, msg])
    }

    if (leg.relay !== undefined || leg.type === 'vmp') {
      this.#log.info(
        '[%s:o] STORED dest=%s hash=%s (block=%s #%s)',
        msg.origin.chainId,
        stop,
        hKey,
        msg.origin.blockHash,
        msg.origin.blockNumber,
      )
      await this.#outbound.put(hKey, msg)
      await new Promise((res) => setImmediate(res)) // allow event loop tick
      await this.#janitor.schedule({
        sublevel: prefixes.matching.outbound,
        key: hKey,
        expiry: this.#expiry,
      })
    }
  }

  async #putHops(...entries: [string, XcmJourney][]) {
    for (const [key, journey] of entries) {
      await this.#hop.put(key, journey as XcmSent)
      await new Promise((res) => setImmediate(res)) // allow event loop tick
      await this.#janitor.schedule({
        sublevel: prefixes.matching.hop,
        key,
        expiry: this.#expiry,
      })
    }
  }

  /**
   * Try to get any stored relay messages and notify if found.
   * do not clean up outbound in case inbound has not arrived yet.
   */
  async #findRelayInbound(outMsg: XcmSent, origin?: XcmSent) {
    const relayKey = outMsg.messageId
      ? matchingKey(outMsg.origin.chainId, outMsg.messageId)
      : matchingKey(outMsg.origin.chainId, outMsg.waypoint.messageHash)
    const relayMsg = await this.#relay.get(relayKey)
    if (relayMsg !== undefined) {
      this.#log.info(
        '[%s:r] RELAYED key=%s (block=%s #%s)',
        outMsg.origin.chainId,
        relayKey,
        outMsg.origin.blockHash,
        outMsg.origin.blockNumber,
      )
      await this.#relay.del(relayKey)
      this.#onXcmRelayed(origin ?? outMsg, relayMsg)
    }
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
      const { instructions, messageData, messageHash, assetsTrapped, assetSwaps, timestamp, specVersion } =
        hopMsg.waypoint
      const currentLeg = hopMsg.legs[0]
      const legIndex = originMsg.legs.findIndex((l) => l.from === currentLeg.from && l.to === currentLeg.to)
      const waypointContext: XcmWaypointContext = {
        legIndex,
        chainId,
        blockHash,
        blockNumber,
        specVersion,
        timestamp,
        event,
        outcome,
        error,
        messageData,
        messageHash,
        messageId: hopMsg.messageId,
        instructions,
        assetsTrapped,
        assetSwaps,
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
      const {
        chainId,
        blockHash,
        blockNumber,
        event,
        outcome,
        error,
        assetsTrapped,
        assetSwaps,
        timestamp,
        specVersion,
      } = hopMsg
      const { messageData, messageHash, instructions } = originMsg.waypoint
      const legIndex = originMsg.legs.findIndex((l) => l.to === chainId)
      const waypointContext: XcmWaypointContext = {
        legIndex,
        chainId,
        blockHash,
        blockNumber,
        specVersion,
        timestamp,
        event,
        outcome,
        error,
        messageData,
        messageHash,
        instructions,
        assetsTrapped,
        assetSwaps,
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
      const { chainId, blockHash, blockNumber, timestamp, event, outcome, error, bridgeKey, specVersion } =
        bridgeInMsg
      const { messageData, messageHash, instructions } = bridgeOutMsg.waypoint
      const legIndex = bridgeOutMsg.legs.findIndex((l) => l.to === chainId && l.type === 'bridge')
      const waypointContext: XcmWaypointContext = {
        legIndex,
        chainId,
        blockHash,
        blockNumber: blockNumber.toString(),
        specVersion,
        timestamp,
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
        const outMsg = safeDestr<XcmSent>(msg)
        const message: XcmTimeout = new GenericXcmTimeout(outMsg)
        this.#log.debug('TIMEOUT on key %s', task.key)
        this.emit('telemetryXcmTimeout', message)
        this.#xcmMatchedReceiver(message)
      }
    } catch (e) {
      this.#log.error(e, 'Error on notification')
    }
  }

  #partialMatched(partialMessage?: HexString, fullMessage?: HexString) {
    if (partialMessage === undefined || fullMessage === undefined) {
      return false
    }
    const length = partialMessage.length
    const partialVersion = partialMessage.substring(0, 4)
    const fullVersion = fullMessage.substring(0, 4)
    if (partialVersion !== fullVersion) {
      // fuzzy match due to difference in Multiassets of V2 and V3
      // tries to match BuyExecution and beneficiary address
      return (
        fullMessage.includes(partialMessage.substring(10, 28)) &&
        fullMessage.includes(partialMessage.substring(length - 65))
      )
    }
    return fullMessage.includes(partialMessage.substring(10))
  }

  async #enhanceInboundWithMessageData(inMsg: XcmInbound) {
    if (inMsg.messageData !== undefined) {
      return
    }
    for (let i = 0; i < MAX_MATCH_RETRIES; i++) {
      try {
        const data =
          inMsg.messageId && inMsg.messageId !== inMsg.messageHash
            ? await Promise.any([
                this.#messageData.get(inMsg.messageHash),
                this.#messageData.get(inMsg.messageId),
              ])
            : await this.#messageData.get(inMsg.messageHash)

        if (data) {
          inMsg.messageData = data
          return
        }
      } catch {
        // Ignore errors, will retry
      }

      await delay(10 * (i + 1))
    }
  }

  async #withRetries<T>(
    fn: () => Promise<T>,
    maxRetries: number = MAX_MATCH_RETRIES,
    delayMs: (attempt: number) => number = (i) => 10 * (i + 1),
  ): Promise<T> {
    let lastError: unknown
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (err) {
        lastError = err
        await delay(delayMs(i))
      }
    }
    throw lastError ?? new Error('Failed after retries')
  }

  async #tryMatchWithDelayedRetries(
    keys: {
      hash: string
      id?: string | undefined
    },
    msg: XcmSent,
  ) {
    await this.#withRetries(() => this.#tryMatchOnOutbound(keys, msg))
  }

  async #tryHopMatchOnInboundWithRetries(msg: XcmInbound): Promise<void> {
    await this.#withRetries(() => this.#tryHopMatchOnInbound(msg))
  }
}
