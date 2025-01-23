import { z } from 'zod'

import { Binary } from 'polkadot-api'
import { Observable, Subscription as RxSubscription } from 'rxjs'

import { ControlQuery } from '@/common/index.js'
import { createNetworkId } from '@/services/config.js'
import {
  HexString,
  RxSubscriptionWithId,
  SignerData,
  Subscription,
  toHexString,
} from '@/services/subscriptions/types.js'
import { AnyJson, NetworkURN } from '@/services/types.js'

function distinct(a: Array<string>) {
  return Array.from(new Set(a))
}

export type MessageHashData = { hash: HexString; data: HexString; topicId?: HexString }

/**
 * XCM storage prefixes.
 */
export const prefixes = {
  matching: {
    outbound: 'xcm:ma:out',
    inbound: 'xcm:ma:in',
    relay: 'xcm:ma:relay',
    hop: 'xcm:ma:hop',
    bridge: 'xcm:ma:bridge',
    bridgeAccepted: 'xcm:ma:bridgeAccepted',
    bridgeDelivered: 'xcm:ma:bridgeDelivered',
    bridgeIn: 'xcm:ma:bridgeIn',
    messageData: 'xcm:ma:messageData',
  },
}

export type Monitor = {
  streams: RxSubscriptionWithId[]
  controls: Record<string, ControlQuery>
}

export type XcmSubscriptionHandler = {
  sendersControl: ControlQuery
  destinationsControl: ControlQuery
  originsControl: ControlQuery
  notificationTypeControl: ControlQuery
  subscription: Subscription<XcmInputs>
  stream: RxSubscription
}

const bridgeTypes = ['pk-bridge', 'snowbridge'] as const

export type BridgeType = (typeof bridgeTypes)[number]

export type RxBridgeSubscription = { type: BridgeType; subs: RxSubscriptionWithId[] }

export type XcmWithContext = {
  event?: AnyJson
  extrinsicPosition?: number
  blockNumber: string | number
  blockHash: HexString
  timestamp?: number
  messageHash: HexString
  messageId?: HexString
  messageData?: HexString
  extrinsicHash?: HexString
}

/**
 * Represents the asset that has been trapped.
 *
 * @public
 */
export type TrappedAsset = {
  version: number
  id: {
    type: string
    value: AnyJson
  }
  fungible: boolean
  amount: string | number
  assetInstance?: AnyJson
}

/**
 * Event emitted when assets are trapped.
 *
 * @public
 */
export type AssetsTrapped = {
  assets: TrappedAsset[]
  hash: HexString
  event: AnyJson
}

/**
 * Represents an XCM program bytes and human JSON.
 */
export type XcmProgram = {
  bytes: Uint8Array
  json: AnyJson
}

export interface XcmSentWithContext extends XcmWithContext {
  messageDataBuffer: Uint8Array
  recipient: NetworkURN
  sender?: SignerData
  instructions: XcmProgram
}

export interface XcmBridgeAcceptedWithContext extends XcmWithContext {
  chainId: NetworkURN
  bridgeKey: HexString
  messageData: HexString
  instructions: AnyJson
  recipient: NetworkURN
  forwardId?: HexString
}

export interface XcmBridgeDeliveredWithContext extends XcmWithContext {
  chainId: NetworkURN
  bridgeKey: HexString
  sender?: SignerData
}

export interface XcmInboundWithContext extends XcmWithContext {
  outcome: 'Success' | 'Fail'
  error?: AnyJson
  assetsTrapped?: AssetsTrapped
}

export interface XcmBridgeInboundWithContext extends XcmInboundWithContext {
  chainId: NetworkURN
  bridgeKey: HexString
}

export interface XcmRelayedWithContext extends XcmInboundWithContext {
  recipient: NetworkURN
  origin: NetworkURN
}

export abstract class BaseGenericXcmWithContext implements XcmWithContext {
  event: AnyJson
  extrinsicPosition?: number
  blockNumber: string
  blockHash: HexString
  timestamp?: number
  messageHash: HexString
  messageData?: HexString
  messageId: HexString
  extrinsicHash?: HexString

  constructor(msg: XcmWithContext) {
    this.event = msg.event
    this.messageHash = msg.messageHash
    this.messageData = msg.messageData
    this.messageId = msg.messageId ?? msg.messageHash
    this.blockHash = msg.blockHash
    this.blockNumber = msg.blockNumber.toString()
    this.timestamp = msg.timestamp
    this.extrinsicPosition = msg.extrinsicPosition
    this.extrinsicHash = msg.extrinsicHash
  }
}

abstract class BaseXcmEvent {
  event: AnyJson
  messageHash: HexString
  messageId?: HexString
  messageData?: HexString
  blockHash: HexString
  blockNumber: string
  timestamp?: number
  extrinsicPosition?: number
  extrinsicHash?: HexString

  constructor(msg: XcmWithContext) {
    this.event = msg.event
    this.messageHash = msg.messageHash
    this.messageId = msg.messageId ?? msg.messageHash
    this.blockHash = msg.blockHash
    this.messageData = msg.messageData
    this.blockNumber = msg.blockNumber.toString()
    this.timestamp = msg.timestamp
    this.extrinsicPosition = msg.extrinsicPosition
    this.extrinsicHash = msg.extrinsicHash
  }
}

export class GenericXcmRelayedWithContext extends BaseGenericXcmWithContext implements XcmRelayedWithContext {
  recipient: NetworkURN
  origin: NetworkURN
  outcome: 'Success' | 'Fail'
  error: AnyJson

  constructor(msg: XcmRelayedWithContext) {
    super(msg)

    this.recipient = msg.recipient
    this.origin = msg.origin
    this.outcome = msg.outcome
    this.error = msg.error
  }
}

export class GenericXcmInboundWithContext extends BaseGenericXcmWithContext implements XcmInboundWithContext {
  outcome: 'Success' | 'Fail'
  error?: AnyJson
  assetsTrapped?: AssetsTrapped

  constructor(msg: XcmInboundWithContext) {
    super(msg)

    this.outcome = msg.outcome
    this.error = msg.error
    this.assetsTrapped = msg.assetsTrapped
  }
}

export class GenericXcmSentWithContext extends BaseXcmEvent implements XcmSentWithContext {
  messageDataBuffer: Uint8Array
  recipient: NetworkURN
  instructions: XcmProgram
  sender?: SignerData

  constructor(msg: XcmSentWithContext) {
    super(msg)

    this.messageDataBuffer = msg.messageDataBuffer
    this.recipient = msg.recipient
    this.instructions = msg.instructions
    this.sender = msg.sender
  }
}

export class GenericXcmBridgeAcceptedWithContext
  extends BaseXcmEvent
  implements XcmBridgeAcceptedWithContext
{
  chainId: NetworkURN
  bridgeKey: HexString
  messageData: HexString
  recipient: NetworkURN
  instructions: AnyJson
  forwardId?: HexString

  constructor(msg: XcmBridgeAcceptedWithContext) {
    super(msg)

    this.chainId = msg.chainId
    this.bridgeKey = msg.bridgeKey
    this.messageData = msg.messageData
    this.recipient = msg.recipient
    this.instructions = msg.instructions
    this.forwardId = msg.forwardId
  }
}

export class GenericXcmBridgeDeliveredWithContext
  extends BaseXcmEvent
  implements XcmBridgeDeliveredWithContext
{
  chainId: NetworkURN
  bridgeKey: HexString
  sender?: SignerData

  constructor(msg: XcmBridgeDeliveredWithContext) {
    super(msg)

    this.chainId = msg.chainId
    this.bridgeKey = msg.bridgeKey
    this.sender = msg.sender
  }
}

export class GenericXcmBridgeInboundWithContext extends BaseXcmEvent implements XcmBridgeInboundWithContext {
  chainId: NetworkURN
  bridgeKey: HexString
  outcome: 'Success' | 'Fail'
  error: AnyJson

  constructor(msg: XcmBridgeInboundWithContext) {
    super(msg)

    this.chainId = msg.chainId
    this.outcome = msg.outcome
    this.error = msg.error
    this.bridgeKey = msg.bridgeKey
  }
}

const XcmNotificationTypes = [
  'xcm.sent',
  'xcm.received',
  'xcm.relayed',
  'xcm.timeout',
  'xcm.hop',
  'xcm.bridge',
] as const

/**
 * @public
 */
export type XcmNotificationType = (typeof XcmNotificationTypes)[number]

/**
 * The terminal point of an XCM journey.
 *
 * @public
 */
export interface XcmTerminus {
  chainId: NetworkURN
}

/**
 * The terminal point of an XCM journey with contextual information.
 *
 * @public
 */
export interface XcmTerminusContext extends XcmWithContext, XcmTerminus {
  outcome: 'Success' | 'Fail'
  error?: AnyJson
  instructions: AnyJson
}

/**
 * The contextual information of an XCM journey waypoint.
 *
 * @public
 */
export interface XcmWaypointContext extends XcmTerminusContext {
  legIndex: number
  assetsTrapped?: AnyJson
}

const legTypes = ['bridge', 'hop', 'hrmp', 'vmp'] as const

/**
 * Type of an XCM journey leg.
 *
 * @public
 */
export type LegType = (typeof legTypes)[number]

/**
 * A leg of an XCM journey.
 *
 * @public
 */
export type Leg = {
  from: NetworkURN
  to: NetworkURN
  relay?: NetworkURN
  partialMessage?: HexString
  type: LegType
}

/**
 * The basic information of an XCM journey.
 *
 * @public
 */
export interface XcmJourney {
  type: XcmNotificationType
  legs: Leg[]
  waypoint: XcmWaypointContext
  origin: XcmTerminusContext
  destination: XcmTerminus | XcmTerminusContext
  sender?: SignerData
  messageId?: HexString
  forwardId?: HexString
}

/**
 * Event emitted when an XCM is sent or received on an intermediate stop.
 *
 * @public
 */
export interface XcmHop extends XcmJourney {
  type: 'xcm.hop'
  direction: 'out' | 'in'
}

/**
 * Event emitted when an XCM is received.
 *
 * @public
 */
export interface XcmReceived extends XcmJourney {
  type: 'xcm.received'
}

/**
 * Event emitted when an XCM is sent.
 *
 * @public
 */

export interface XcmSent extends XcmJourney {
  type: 'xcm.sent'
}

/**
 * Event emitted when an XCM is not received within a specified timeframe.
 *
 * @public
 */
export interface XcmTimeout extends XcmJourney {
  type: 'xcm.timeout'
}

/**
 * Event emitted when an XCM is received on the relay chain
 * for an HRMP message.
 *
 * @public
 */
export interface XcmRelayed extends XcmJourney {
  type: 'xcm.relayed'
}

export class XcmInbound extends BaseXcmEvent {
  chainId: NetworkURN
  outcome: 'Success' | 'Fail'
  error?: AnyJson
  assetsTrapped?: AssetsTrapped

  constructor(chainId: NetworkURN, msg: XcmInboundWithContext) {
    super(msg)

    this.chainId = chainId
    this.outcome = msg.outcome
    this.error = msg.error
    this.assetsTrapped = msg.assetsTrapped
  }
}

abstract class BaseXcmJourney {
  legs: Leg[]
  sender?: SignerData
  messageId?: HexString
  forwardId?: HexString

  constructor(msg: Omit<XcmJourney, 'origin' | 'destination' | 'waypoint' | 'type'>) {
    this.legs = msg.legs
    this.sender = msg.sender
    this.messageId = msg.messageId
    this.forwardId = msg.forwardId
  }
}

export class GenericXcmSent extends BaseXcmJourney implements XcmSent {
  type = 'xcm.sent' as const
  waypoint: XcmWaypointContext
  origin: XcmTerminusContext
  destination: XcmTerminus

  constructor(chainId: NetworkURN, msg: XcmSentWithContext, legs: Leg[], forwardId?: HexString) {
    super({
      legs,
      forwardId,
      messageId: msg.messageId,
      sender: msg.sender,
    })

    this.origin = {
      chainId,
      blockHash: msg.blockHash,
      blockNumber: msg.blockNumber.toString(),
      extrinsicHash: msg.extrinsicHash,
      timestamp: msg.timestamp,
      extrinsicPosition: msg.extrinsicPosition,
      event: msg.event,
      outcome: 'Success',
      error: null,
      messageData: toHexString(msg.messageDataBuffer),
      instructions: msg.instructions.json,
      messageHash: msg.messageHash,
    }
    this.destination = {
      chainId: legs[legs.length - 1].to, // last stop is the destination
    }
    this.waypoint = {
      ...this.origin,
      legIndex: 0,
      messageData: toHexString(msg.messageDataBuffer),
      instructions: msg.instructions.json,
      messageHash: msg.messageHash,
    }
  }
}

export class GenericXcmTimeout extends BaseXcmJourney implements XcmTimeout {
  type = 'xcm.timeout' as const
  waypoint: XcmWaypointContext
  origin: XcmTerminusContext
  destination: XcmTerminus

  constructor(msg: XcmSent) {
    super(msg)

    this.origin = msg.origin
    this.destination = msg.destination
    this.waypoint = msg.waypoint
  }
}

export class GenericXcmReceived extends BaseXcmJourney implements XcmReceived {
  type = 'xcm.received' as const
  waypoint: XcmWaypointContext
  origin: XcmTerminusContext
  destination: XcmTerminusContext

  constructor(outMsg: XcmSent, inMsg: XcmInbound) {
    super(outMsg)

    this.destination = {
      chainId: inMsg.chainId,
      blockNumber: inMsg.blockNumber,
      blockHash: inMsg.blockHash,
      timestamp: inMsg.timestamp,
      extrinsicHash: inMsg.extrinsicHash,
      extrinsicPosition: inMsg.extrinsicPosition,
      event: inMsg.event,
      outcome: inMsg.outcome,
      error: inMsg.error,
      instructions: outMsg.waypoint.instructions,
      messageData: outMsg.waypoint.messageData,
      messageHash: outMsg.waypoint.messageHash,
    }
    this.origin = outMsg.origin
    this.waypoint = {
      ...this.destination,
      legIndex: this.legs.findIndex((l) => l.to === inMsg.chainId && l.type !== 'bridge'),
      instructions: outMsg.waypoint.instructions,
      messageData: outMsg.waypoint.messageData,
      messageHash: outMsg.waypoint.messageHash,
      assetsTrapped: inMsg.assetsTrapped,
    }
  }
}

export class GenericXcmRelayed extends BaseXcmJourney implements XcmRelayed {
  type = 'xcm.relayed' as const
  waypoint: XcmWaypointContext
  origin: XcmTerminusContext
  destination: XcmTerminus

  constructor(outMsg: XcmSent, relayMsg: XcmRelayedWithContext) {
    super(outMsg)

    this.destination = outMsg.destination
    this.origin = outMsg.origin
    this.waypoint = {
      legIndex: outMsg.legs.findIndex((l) => l.from === relayMsg.origin && l.relay !== undefined),
      chainId: createNetworkId(relayMsg.origin, '0'), // relay waypoint always at relay chain
      blockNumber: relayMsg.blockNumber.toString(),
      blockHash: relayMsg.blockHash,
      timestamp: relayMsg.timestamp,
      extrinsicHash: relayMsg.extrinsicHash,
      extrinsicPosition: relayMsg.extrinsicPosition,
      event: relayMsg.event,
      outcome: relayMsg.outcome,
      error: relayMsg.error,
      instructions: outMsg.waypoint.instructions,
      messageData: outMsg.waypoint.messageData,
      messageHash: outMsg.waypoint.messageHash,
    }
  }
}

export class GenericXcmHop extends BaseXcmJourney implements XcmHop {
  type = 'xcm.hop' as const
  direction: 'out' | 'in'
  waypoint: XcmWaypointContext
  origin: XcmTerminusContext
  destination: XcmTerminus

  constructor(originMsg: XcmSent, hopWaypoint: XcmWaypointContext, direction: 'out' | 'in') {
    super(originMsg)
    this.origin = originMsg.origin
    this.destination = originMsg.destination
    this.waypoint = hopWaypoint
    this.direction = direction
  }
}

/**
 * @public
 */
export type BridgeMessageType = 'accepted' | 'delivered' | 'received'

/**
 * Event emitted when an XCM is sent or received on an intermediate stop.
 *
 * @public
 */
export interface XcmBridge extends XcmJourney {
  type: 'xcm.bridge'
  bridgeKey: HexString
  bridgeMessageType: BridgeMessageType
}

type XcmBridgeContext = {
  bridgeMessageType: BridgeMessageType
  bridgeKey: HexString
  forwardId?: HexString
}

export class GenericXcmBridge extends BaseXcmJourney implements XcmBridge {
  type = 'xcm.bridge' as const
  bridgeMessageType: BridgeMessageType
  bridgeKey: HexString
  waypoint: XcmWaypointContext
  origin: XcmTerminusContext
  destination: XcmTerminus

  constructor(
    originMsg: XcmBridge,
    waypoint: XcmWaypointContext,
    { bridgeKey, bridgeMessageType, forwardId }: XcmBridgeContext,
  ) {
    super({ ...originMsg, forwardId })

    this.bridgeMessageType = bridgeMessageType
    this.origin = originMsg.origin
    this.destination = originMsg.destination
    this.waypoint = waypoint
    this.bridgeKey = bridgeKey
  }
}

/**
 * The XCM payloads.
 *
 * @public
 */
export type XcmMessagePayload = XcmSent | XcmReceived | XcmRelayed | XcmHop | XcmBridge | XcmTimeout

export function isXcmSent(object: any): object is XcmSent {
  return object.type !== undefined && object.type === 'xcm.sent'
}

export function isXcmReceived(object: any): object is XcmReceived {
  return object.type !== undefined && object.type === 'xcm.received'
}

export function isXcmHop(object: any): object is XcmHop {
  return object.type !== undefined && object.type === 'xcm.hop'
}

export function isXcmRelayed(object: any): object is XcmRelayed {
  return object.type !== undefined && object.type === 'xcm.relayed'
}

const XCM_NOTIFICATION_TYPE_ERROR = `at least 1 event type is required [${XcmNotificationTypes.join(',')}]`

export const $XcmInputs = z.object({
  origins: z.literal('*').or(
    z
      .array(
        z
          .string({
            required_error: 'at least 1 origin is required',
          })
          .min(1),
      )
      .transform(distinct),
  ),
  senders: z.optional(
    z
      .literal('*')
      .or(z.array(z.string()).min(1, 'at least 1 sender address is required').transform(distinct)),
  ),
  destinations: z.literal('*').or(
    z
      .array(
        z
          .string({
            required_error: 'at least 1 destination is required',
          })
          .min(1),
      )
      .transform(distinct),
  ),
  bridges: z.optional(z.array(z.enum(bridgeTypes)).min(1, 'Please specify at least one bridge.')),
  // prevent using $refs
  events: z.optional(
    z.literal('*').or(z.array(z.enum(XcmNotificationTypes)).min(1, XCM_NOTIFICATION_TYPE_ERROR)),
  ),
})

export type XcmInputs = z.infer<typeof $XcmInputs>

export type GetOutboundHrmpMessages = (hash: HexString) => Observable<
  {
    recipient: number
    data: Binary
  }[]
>

export type GetOutboundUmpMessages = (hash: HexString) => Observable<Binary[]>

export type GetDownwardMessageQueues = (
  hash: HexString,
  networkId: NetworkURN,
) => Observable<{ sentAt: number; msg: Binary }[]>

export type GetStorageAt = (hash: HexString, key: HexString) => Observable<HexString>
