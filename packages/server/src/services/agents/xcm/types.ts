import { z } from 'zod'

import { ControlQuery } from '@/sdk/index.js'
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
  },
}

export type Monitor = {
  streams: RxSubscriptionWithId[]
  controls: Record<string, ControlQuery>
}

export type XcmSubscriptionHandler = {
  originSubs: RxSubscriptionWithId[]
  destinationSubs: RxSubscriptionWithId[]
  bridgeSubs: RxBridgeSubscription[]
  sendersControl: ControlQuery
  messageControl: ControlQuery
  subscription: Subscription<XcmInputs>
  relaySub?: RxSubscriptionWithId
}

const bridgeTypes = ['pk-bridge', 'snowbridge'] as const

export type BridgeType = (typeof bridgeTypes)[number]

export type RxBridgeSubscription = { type: BridgeType; subs: RxSubscriptionWithId[] }

export type XcmCriteria = {
  sendersControl: ControlQuery
  messageControl: ControlQuery
}

export type XcmWithContext = {
  event?: AnyJson
  extrinsicPosition?: number
  blockNumber: string | number
  blockHash: HexString
  timestamp?: number
  messageHash: HexString
  messageId?: HexString
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
  messageData: Uint8Array
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

export interface XcmBridgeDeliveredWithContext {
  chainId: NetworkURN
  bridgeKey: HexString
  event?: AnyJson
  extrinsicPosition?: number
  blockNumber: string | number
  blockHash: HexString
  timestamp?: number
  sender?: SignerData
}

export interface XcmBridgeInboundWithContext {
  chainId: NetworkURN
  bridgeKey: HexString
  blockNumber: string | number
  blockHash: HexString
  timestamp?: number
  outcome: 'Success' | 'Fail'
  error: AnyJson
  event?: AnyJson
  extrinsicPosition?: number
}

export interface XcmBridgeInboundWithContext {
  chainId: NetworkURN
  bridgeKey: HexString
  blockNumber: string | number
  blockHash: HexString
  timestamp?: number
  outcome: 'Success' | 'Fail'
  error: AnyJson
  event?: AnyJson
  extrinsicPosition?: number
}

export interface XcmInboundWithContext extends XcmWithContext {
  outcome: 'Success' | 'Fail'
  error?: AnyJson
  assetsTrapped?: AssetsTrapped
}

export interface XcmRelayedWithContext extends XcmInboundWithContext {
  recipient: NetworkURN
  origin: NetworkURN
}

export class GenericXcmRelayedWithContext implements XcmRelayedWithContext {
  event: AnyJson
  extrinsicPosition?: number
  blockNumber: string | number
  blockHash: HexString
  timestamp?: number
  messageHash: HexString
  messageId?: HexString
  recipient: NetworkURN
  origin: NetworkURN
  outcome: 'Success' | 'Fail'
  error: AnyJson

  constructor(msg: XcmRelayedWithContext) {
    this.event = msg.event
    this.messageHash = msg.messageHash
    this.messageId = msg.messageId ?? msg.messageHash
    this.blockHash = msg.blockHash
    this.blockNumber = msg.blockNumber.toString()
    this.timestamp = msg.timestamp
    this.extrinsicPosition = msg.extrinsicPosition
    this.recipient = msg.recipient
    this.origin = msg.origin
    this.outcome = msg.outcome
    this.error = msg.error
  }

  toHuman(_isExpanded?: boolean | undefined): Record<string, AnyJson> {
    return {
      messageHash: this.messageHash,
      messageId: this.messageId,
      extrinsicPosition: this.extrinsicPosition,
      blockHash: this.blockHash,
      blockNumber: this.blockNumber,
      timestamp: this.timestamp,
      event: this.event,
      recipient: this.recipient,
      origin: this.origin,
      outcome: this.outcome,
      error: this.error,
    }
  }
}

export class GenericXcmInboundWithContext implements XcmInboundWithContext {
  event: AnyJson
  extrinsicPosition?: number
  blockNumber: string
  blockHash: HexString
  timestamp?: number
  messageHash: HexString
  messageId: HexString
  outcome: 'Success' | 'Fail'
  error?: AnyJson
  assetsTrapped?: AssetsTrapped

  constructor(msg: XcmInboundWithContext) {
    this.event = msg.event
    this.messageHash = msg.messageHash
    this.messageId = msg.messageId ?? msg.messageHash
    this.outcome = msg.outcome
    this.error = msg.error
    this.blockHash = msg.blockHash
    this.blockNumber = msg.blockNumber.toString()
    this.timestamp = msg.timestamp
    this.extrinsicPosition = msg.extrinsicPosition
    this.assetsTrapped = msg.assetsTrapped
  }

  toHuman(_isExpanded?: boolean | undefined): Record<string, AnyJson> {
    return {
      messageHash: this.messageHash,
      messageId: this.messageId,
      extrinsicPosition: this.extrinsicPosition,
      blockHash: this.blockHash,
      blockNumber: this.blockNumber,
      timestamp: this.timestamp,
      event: this.event,
      outcome: this.outcome,
      error: this.error,
      assetsTrapped: this.assetsTrapped,
    }
  }
}

export class XcmInbound {
  subscriptionId: string
  chainId: NetworkURN
  event: AnyJson
  messageHash: HexString
  messageId: HexString
  outcome: 'Success' | 'Fail'
  error: AnyJson
  blockHash: HexString
  blockNumber: string
  timestamp?: number
  extrinsicPosition?: number
  assetsTrapped?: AssetsTrapped

  constructor(subscriptionId: string, chainId: NetworkURN, msg: XcmInboundWithContext) {
    this.subscriptionId = subscriptionId
    this.chainId = chainId
    this.event = msg.event
    this.messageHash = msg.messageHash
    this.messageId = msg.messageId ?? msg.messageHash
    this.outcome = msg.outcome
    this.error = msg.error
    this.blockHash = msg.blockHash
    this.blockNumber = msg.blockNumber.toString()
    this.timestamp = msg.timestamp
    this.extrinsicPosition = msg.extrinsicPosition
    this.assetsTrapped = msg.assetsTrapped
  }
}

export class GenericXcmSentWithContext implements XcmSentWithContext {
  messageData: Uint8Array
  recipient: NetworkURN
  instructions: XcmProgram
  messageHash: HexString
  event: AnyJson
  blockHash: HexString
  blockNumber: string
  timestamp?: number | undefined
  sender?: SignerData
  extrinsicPosition?: number
  messageId?: HexString

  constructor(msg: XcmSentWithContext) {
    this.event = msg.event
    this.messageData = msg.messageData
    this.recipient = msg.recipient
    this.instructions = msg.instructions
    this.messageHash = msg.messageHash
    this.blockHash = msg.blockHash
    this.blockNumber = msg.blockNumber.toString()
    this.timestamp = msg.timestamp
    this.extrinsicPosition = msg.extrinsicPosition
    this.messageId = msg.messageId
    this.sender = msg.sender
  }

  toHuman(_isExpanded?: boolean | undefined): Record<string, AnyJson> {
    return {
      messageData: toHexString(this.messageData),
      recipient: this.recipient,
      instructions: this.instructions.json,
      messageHash: this.messageHash,
      event: this.event,
      blockHash: this.blockHash,
      blockNumber: this.blockNumber,
      timestamp: this.timestamp,
      extrinsicPosition: this.extrinsicPosition,
      messageId: this.messageId,
      senders: this.sender,
    }
  }
}

export class GenericXcmBridgeAcceptedWithContext implements XcmBridgeAcceptedWithContext {
  chainId: NetworkURN
  bridgeKey: HexString
  messageData: HexString
  recipient: NetworkURN
  instructions: AnyJson
  messageHash: HexString
  event: AnyJson
  blockHash: HexString
  blockNumber: string
  timestamp?: number | undefined
  extrinsicPosition?: number
  messageId?: HexString
  forwardId?: HexString

  constructor(msg: XcmBridgeAcceptedWithContext) {
    this.chainId = msg.chainId
    this.bridgeKey = msg.bridgeKey
    this.event = msg.event
    this.messageData = msg.messageData
    this.recipient = msg.recipient
    this.instructions = msg.instructions
    this.messageHash = msg.messageHash
    this.blockHash = msg.blockHash
    this.blockNumber = msg.blockNumber.toString()
    this.timestamp = msg.timestamp
    this.extrinsicPosition = msg.extrinsicPosition
    this.messageId = msg.messageId
    this.forwardId = msg.forwardId
  }
}

export class GenericXcmBridgeDeliveredWithContext implements XcmBridgeDeliveredWithContext {
  chainId: NetworkURN
  bridgeKey: HexString
  event?: AnyJson
  extrinsicPosition?: number
  blockNumber: string
  blockHash: HexString
  timestamp?: number | undefined
  sender?: SignerData

  constructor(msg: XcmBridgeDeliveredWithContext) {
    this.chainId = msg.chainId
    this.bridgeKey = msg.bridgeKey
    this.event = msg.event
    this.extrinsicPosition = msg.extrinsicPosition
    this.blockNumber = msg.blockNumber.toString()
    this.blockHash = msg.blockHash
    this.timestamp = msg.timestamp
    this.sender = msg.sender
  }
}

export class GenericXcmBridgeInboundWithContext implements XcmBridgeInboundWithContext {
  chainId: NetworkURN
  bridgeKey: HexString
  event: AnyJson
  extrinsicPosition?: number | undefined
  blockNumber: string
  blockHash: HexString
  timestamp?: number | undefined
  outcome: 'Success' | 'Fail'
  error: AnyJson

  constructor(msg: XcmBridgeInboundWithContext) {
    this.chainId = msg.chainId
    this.event = msg.event
    this.outcome = msg.outcome
    this.error = msg.error
    this.blockHash = msg.blockHash
    this.blockNumber = msg.blockNumber.toString()
    this.timestamp = msg.timestamp
    this.extrinsicPosition = msg.extrinsicPosition
    this.bridgeKey = msg.bridgeKey
  }
}

export enum XcmNotificationType {
  Sent = 'xcm.sent',
  Received = 'xcm.received',
  Relayed = 'xcm.relayed',
  Timeout = 'xcm.timeout',
  Hop = 'xcm.hop',
  Bridge = 'xcm.bridge',
}

/**
 * The terminal point of an XCM journey.
 *
 * @public
 */
export type XcmTerminus = {
  chainId: NetworkURN
}

/**
 * The terminal point of an XCM journey with contextual information.
 *
 * @public
 */
export interface XcmTerminusContext extends XcmTerminus {
  blockNumber: string
  blockHash: HexString
  timestamp?: number
  extrinsicPosition?: number
  event: AnyJson
  outcome: 'Success' | 'Fail'
  error: AnyJson
  messageHash: HexString
  messageData: string
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

/**
 * Type of an XCM journey leg.
 *
 * @public
 */
export const legType = ['bridge', 'hop', 'hrmp', 'vmp'] as const

/**
 * A leg of an XCM journey.
 *
 * @public
 */
export type Leg = {
  from: NetworkURN
  to: NetworkURN
  relay?: NetworkURN
  type: (typeof legType)[number]
}

/**
 * Event emitted when an XCM is sent.
 *
 * @public
 */
export interface XcmSent {
  type: XcmNotificationType
  subscriptionId: string
  legs: Leg[]
  waypoint: XcmWaypointContext
  origin: XcmTerminusContext
  destination: XcmTerminus
  sender?: SignerData
  messageId?: HexString
  forwardId?: HexString
}

export class GenericXcmSent implements XcmSent {
  type: XcmNotificationType = XcmNotificationType.Sent
  subscriptionId: string
  legs: Leg[]
  waypoint: XcmWaypointContext
  origin: XcmTerminusContext
  destination: XcmTerminus
  sender?: SignerData
  messageId?: HexString
  forwardId?: HexString

  constructor(
    subscriptionId: string,
    chainId: NetworkURN,
    msg: XcmSentWithContext,
    legs: Leg[],
    forwardId?: HexString,
  ) {
    this.subscriptionId = subscriptionId
    this.legs = legs
    this.origin = {
      chainId,
      blockHash: msg.blockHash,
      blockNumber: msg.blockNumber.toString(),
      timestamp: msg.timestamp,
      extrinsicPosition: msg.extrinsicPosition,
      event: msg.event,
      outcome: 'Success',
      error: null,
      messageData: toHexString(msg.messageData),
      instructions: msg.instructions.json,
      messageHash: msg.messageHash,
    }
    this.destination = {
      chainId: legs[legs.length - 1].to, // last stop is the destination
    }
    this.waypoint = {
      ...this.origin,
      legIndex: 0,
      messageData: toHexString(msg.messageData),
      instructions: msg.instructions.json,
      messageHash: msg.messageHash,
    }

    this.messageId = msg.messageId
    this.forwardId = forwardId
    this.sender = msg.sender
  }
}

/**
 * Event emitted when an XCM is received.
 *
 * @public
 */
export interface XcmReceived {
  type: XcmNotificationType
  subscriptionId: string
  legs: Leg[]
  waypoint: XcmWaypointContext
  origin: XcmTerminusContext
  destination: XcmTerminusContext
  sender?: SignerData
  messageId?: HexString
  forwardId?: HexString
}

/**
 * Event emitted when an XCM is not received within a specified timeframe.
 *
 * @public
 */
export type XcmTimeout = XcmSent

export class GenericXcmTimeout implements XcmTimeout {
  type: XcmNotificationType = XcmNotificationType.Timeout
  subscriptionId: string
  legs: Leg[]
  waypoint: XcmWaypointContext
  origin: XcmTerminusContext
  destination: XcmTerminus
  sender?: SignerData
  messageId?: HexString
  forwardId?: HexString

  constructor(msg: XcmSent) {
    this.subscriptionId = msg.subscriptionId
    this.legs = msg.legs
    this.origin = msg.origin
    this.destination = msg.destination
    this.waypoint = msg.waypoint
    this.messageId = msg.messageId
    this.sender = msg.sender
    this.forwardId = msg.forwardId
  }
}

export class GenericXcmReceived implements XcmReceived {
  type: XcmNotificationType = XcmNotificationType.Received
  subscriptionId: string
  legs: Leg[]
  waypoint: XcmWaypointContext
  origin: XcmTerminusContext
  destination: XcmTerminusContext
  sender?: SignerData
  messageId?: HexString
  forwardId?: HexString

  constructor(outMsg: XcmSent, inMsg: XcmInbound) {
    this.subscriptionId = outMsg.subscriptionId
    this.legs = outMsg.legs
    this.destination = {
      chainId: inMsg.chainId,
      blockNumber: inMsg.blockNumber,
      blockHash: inMsg.blockHash,
      timestamp: inMsg.timestamp,
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
    this.sender = outMsg.sender
    this.messageId = outMsg.messageId
    this.forwardId = outMsg.forwardId
  }
}

/**
 * Event emitted when an XCM is received on the relay chain
 * for an HRMP message.
 *
 * @public
 */
export type XcmRelayed = XcmSent

export class GenericXcmRelayed implements XcmRelayed {
  type: XcmNotificationType = XcmNotificationType.Relayed
  subscriptionId: string
  legs: Leg[]
  waypoint: XcmWaypointContext
  origin: XcmTerminusContext
  destination: XcmTerminus
  sender?: SignerData
  messageId?: HexString
  forwardId?: HexString

  constructor(outMsg: XcmSent, relayMsg: XcmRelayedWithContext) {
    this.subscriptionId = outMsg.subscriptionId
    this.legs = outMsg.legs
    this.destination = outMsg.destination
    this.origin = outMsg.origin
    this.waypoint = {
      legIndex: outMsg.legs.findIndex((l) => l.from === relayMsg.origin && l.relay !== undefined),
      chainId: createNetworkId(relayMsg.origin, '0'), // relay waypoint always at relay chain
      blockNumber: relayMsg.blockNumber.toString(),
      blockHash: relayMsg.blockHash,
      timestamp: relayMsg.timestamp,
      extrinsicPosition: relayMsg.extrinsicPosition,
      event: relayMsg.event,
      outcome: relayMsg.outcome,
      error: relayMsg.error,
      instructions: outMsg.waypoint.instructions,
      messageData: outMsg.waypoint.messageData,
      messageHash: outMsg.waypoint.messageHash,
    }
    this.sender = outMsg.sender
    this.messageId = outMsg.messageId
    this.forwardId = outMsg.forwardId
  }
}

/**
 * Event emitted when an XCM is sent or received on an intermediate stop.
 *
 * @public
 */
export interface XcmHop extends XcmSent {
  direction: 'out' | 'in'
}

export class GenericXcmHop implements XcmHop {
  type: XcmNotificationType = XcmNotificationType.Hop
  direction: 'out' | 'in'
  subscriptionId: string
  legs: Leg[]
  waypoint: XcmWaypointContext
  origin: XcmTerminusContext
  destination: XcmTerminus
  sender?: SignerData
  messageId?: HexString
  forwardId?: HexString

  constructor(originMsg: XcmSent, hopWaypoint: XcmWaypointContext, direction: 'out' | 'in') {
    this.subscriptionId = originMsg.subscriptionId
    this.legs = originMsg.legs
    this.origin = originMsg.origin
    this.destination = originMsg.destination
    this.waypoint = hopWaypoint
    this.messageId = originMsg.messageId
    this.sender = originMsg.sender
    this.direction = direction
    this.forwardId = originMsg.forwardId
  }
}

export type BridgeMessageType = 'accepted' | 'delivered' | 'received'

/**
 * Event emitted when an XCM is sent or received on an intermediate stop.
 *
 * @public
 */
export interface XcmBridge extends XcmSent {
  bridgeKey: HexString
  bridgeMessageType: BridgeMessageType
}

type XcmBridgeContext = {
  bridgeMessageType: BridgeMessageType
  bridgeKey: HexString
  forwardId?: HexString
}

export class GenericXcmBridge implements XcmBridge {
  type: XcmNotificationType = XcmNotificationType.Bridge
  bridgeMessageType: BridgeMessageType
  subscriptionId: string
  bridgeKey: HexString
  legs: Leg[]
  waypoint: XcmWaypointContext
  origin: XcmTerminusContext
  destination: XcmTerminus
  sender?: SignerData
  messageId?: HexString
  forwardId?: HexString

  constructor(
    originMsg: XcmSent,
    waypoint: XcmWaypointContext,
    { bridgeKey, bridgeMessageType, forwardId }: XcmBridgeContext,
  ) {
    this.subscriptionId = originMsg.subscriptionId
    this.bridgeMessageType = bridgeMessageType
    this.legs = originMsg.legs
    this.origin = originMsg.origin
    this.destination = originMsg.destination
    this.waypoint = waypoint
    this.messageId = originMsg.messageId
    this.sender = originMsg.sender
    this.bridgeKey = bridgeKey
    this.forwardId = forwardId
  }
}

/**
 * The XCM payloads.
 *
 * @public
 */
export type XcmMessagePayload = XcmSent | XcmReceived | XcmRelayed | XcmHop | XcmBridge

export function isXcmSent(object: any): object is XcmSent {
  return object.type !== undefined && object.type === XcmNotificationType.Sent
}

export function isXcmReceived(object: any): object is XcmReceived {
  return object.type !== undefined && object.type === XcmNotificationType.Received
}

export function isXcmHop(object: any): object is XcmHop {
  return object.type !== undefined && object.type === XcmNotificationType.Hop
}

export function isXcmRelayed(object: any): object is XcmRelayed {
  return object.type !== undefined && object.type === XcmNotificationType.Relayed
}

const XCM_NOTIFICATION_TYPE_ERROR = `at least 1 event type is required [${Object.values(
  XcmNotificationType,
).join(',')}]`

const XCM_OUTBOUND_TTL_TYPE_ERROR = 'XCM outbound message TTL should be at least 6 seconds'

export const $XcmInputs = z.object({
  origin: z
    .string({
      required_error: 'origin id is required',
    })
    .min(1),
  senders: z.optional(
    z
      .literal('*')
      .or(z.array(z.string()).min(1, 'at least 1 sender address is required').transform(distinct)),
  ),
  destinations: z
    .array(
      z
        .string({
          required_error: 'destination id is required',
        })
        .min(1),
    )
    .transform(distinct),
  bridges: z.optional(z.array(z.enum(bridgeTypes)).min(1, 'Please specify at least one bridge.')),
  // prevent using $refs
  events: z.optional(
    z.literal('*').or(z.array(z.nativeEnum(XcmNotificationType)).min(1, XCM_NOTIFICATION_TYPE_ERROR)),
  ),
  outboundTTL: z.optional(z.number().min(6000, XCM_OUTBOUND_TTL_TYPE_ERROR).max(Number.MAX_SAFE_INTEGER)),
})

export type XcmInputs = z.infer<typeof $XcmInputs>
