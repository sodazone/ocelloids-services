import { asAccountId, isEVMAddress, normalizePublicKey } from '@/common/util.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import { AssetRole } from '../crosschain/index.js'

export type FormattedAddress = {
  key: HexString
  formatted?: string
}

export type MessageOutcome = 'Success' | 'Fail'

export type MessageContext = {
  blockNumber: string
  blockHash: HexString
  outcome: MessageOutcome
  timestamp?: number
  txHash?: HexString
  txHashSecondary?: HexString
}

export interface BasejumpContext {
  chainId: NetworkURN
  blockNumber: string
  blockHash: HexString
  txHash?: HexString
  txHashSecondary?: HexString
  timestamp?: number
}

export interface BasejumpInitiatedWithContext extends BasejumpContext {
  vaaId?: string
  destination: NetworkURN
  sender: HexString
  recipient: HexString
  asset: string
  amount: string
  fee: string
}

export interface BasejumpRelayedWithContext extends BasejumpContext {
  vaaId: string
  relayer: HexString
  guardianSet: number
  payload: string
  outcome: MessageOutcome
  recipient: HexString
  asset: string
  amount: string
}

export interface BasejumpPendingWithContext extends BasejumpContext {
  type: 'queued' | 'fulfilled'
  vaaId?: string
  outcome: MessageOutcome
  recipient: HexString
  asset: string
  amount: string
  id: string
}

export interface BasejumpExecutedWithContext extends BasejumpContext {
  type: 'executed'
  vaaId?: string
  outcome: MessageOutcome
  recipient: HexString
  asset: string
  amount: string
}

export type BasejumpLandedWithContext = BasejumpExecutedWithContext | BasejumpPendingWithContext

export interface MessageTerminus {
  chainId: NetworkURN
}

export type MessageTerminusContext = MessageTerminus & MessageContext

export type BasejumpJourneyType =
  | 'basejump.initiated'
  | 'basejump.processed'
  | 'basejump.executed'
  | 'basejump.queued'
  | 'basejump.fulfilled'
  | 'basejump.unmatched'

export interface BasejumpJourney {
  type: BasejumpJourneyType
  originProtocol: string
  destinationProtocol: string
  waypoint: MessageTerminusContext
  origin: MessageTerminusContext
  destination: MessageTerminus | MessageTerminusContext
  from: FormattedAddress
  to: FormattedAddress
  asset: string
  amount: string
  fee?: string
  vaaId?: string
}

function toFormattedAddresses(address: HexString): FormattedAddress {
  const key = normalizePublicKey(address)
  return isEVMAddress(key)
    ? {
        key: key,
      }
    : {
        key: key,
        formatted: asAccountId(key),
      }
}

export function toMatchingKey(receiver: string | FormattedAddress, asset: string, amount: string) {
  const receiverKey = typeof receiver === 'string' ? receiver : receiver.key
  return `${receiverKey}|${asset}|${amount}`
}

abstract class BasejumpJourneyBase {
  originProtocol: string = 'basejump'
  destinationProtocol: string = 'basejump'

  matchingKey: string
  to: FormattedAddress
  asset: string
  amount: string
  fee?: string

  constructor(msg: { recipient: HexString; asset: string; amount: string; fee?: string }) {
    const recipient = toFormattedAddresses(msg.recipient)
    this.to = recipient
    this.asset = msg.asset
    this.amount = msg.amount.toString()
    this.fee = msg.fee?.toString()
    this.matchingKey = toMatchingKey(recipient, msg.asset, msg.amount)
  }
}

export class BasejumpInitiated extends BasejumpJourneyBase implements BasejumpJourney {
  type: BasejumpJourneyType = 'basejump.initiated'
  origin: MessageTerminusContext
  destination: MessageTerminus | MessageTerminusContext
  waypoint: MessageTerminusContext
  from: FormattedAddress
  vaaId?: string

  constructor(msg: BasejumpInitiatedWithContext) {
    super(msg)

    this.origin = {
      chainId: msg.chainId,
      blockHash: msg.blockHash,
      blockNumber: msg.blockNumber,
      timestamp: msg.timestamp,
      txHash: msg.txHash,
      outcome: 'Success',
    }
    this.waypoint = this.origin
    this.destination = {
      chainId: msg.destination,
    }
    this.from = toFormattedAddresses(msg.sender)
    this.vaaId = msg.vaaId
  }
}

export class BasejumpProcessed extends BasejumpJourneyBase implements BasejumpJourney {
  type: BasejumpJourneyType = 'basejump.processed'
  origin: MessageTerminusContext
  destination: MessageTerminus | MessageTerminusContext
  waypoint: MessageTerminusContext
  vaaId: string
  payload: string
  relayer: FormattedAddress
  from: FormattedAddress
  guardianSet: number

  constructor(initMsg: BasejumpInitiated, relayMsg: BasejumpRelayedWithContext) {
    super(relayMsg)

    this.origin = initMsg.origin
    this.waypoint = {
      chainId: relayMsg.chainId,
      blockHash: relayMsg.blockHash,
      blockNumber: relayMsg.blockNumber,
      timestamp: relayMsg.timestamp,
      txHash: relayMsg.txHash,
      txHashSecondary: relayMsg.txHashSecondary,
      outcome: relayMsg.outcome,
    }
    this.destination = initMsg.destination
    this.from = initMsg.from
    this.vaaId = relayMsg.vaaId
    this.payload = relayMsg.payload
    this.relayer = toFormattedAddresses(relayMsg.relayer)
    this.guardianSet = relayMsg.guardianSet
  }
}

export class BasejumpExecuted extends BasejumpJourneyBase implements BasejumpJourney {
  type: BasejumpJourneyType = 'basejump.executed'
  origin: MessageTerminusContext
  destination: MessageTerminus | MessageTerminusContext
  waypoint: MessageTerminusContext
  from: FormattedAddress
  vaaId?: string

  constructor(initMsg: BasejumpInitiated, executedMsg: BasejumpExecutedWithContext) {
    super(executedMsg)

    const waypointCtx: MessageTerminusContext = {
      chainId: executedMsg.chainId,
      blockHash: executedMsg.blockHash,
      blockNumber: executedMsg.blockNumber,
      timestamp: executedMsg.timestamp,
      txHash: executedMsg.txHash,
      outcome: executedMsg.outcome,
    }

    this.origin = initMsg.origin
    this.waypoint = waypointCtx
    this.destination = waypointCtx
    this.from = initMsg.from
    this.vaaId = executedMsg.vaaId
  }
}

export class BasejumpPending extends BasejumpJourneyBase implements BasejumpJourney {
  type: BasejumpJourneyType
  origin: MessageTerminusContext
  destination: MessageTerminus | MessageTerminusContext
  waypoint: MessageTerminusContext
  from: FormattedAddress
  id: string
  vaaId?: string

  constructor(initMsg: BasejumpInitiated, pendingMsg: BasejumpPendingWithContext) {
    super(pendingMsg)

    this.type = pendingMsg.type === 'queued' ? 'basejump.queued' : 'basejump.fulfilled'
    const waypointCtx: MessageTerminusContext = {
      chainId: pendingMsg.chainId,
      blockHash: pendingMsg.blockHash,
      blockNumber: pendingMsg.blockNumber,
      timestamp: pendingMsg.timestamp,
      txHash: pendingMsg.txHash,
      outcome: pendingMsg.outcome,
    }

    this.origin = initMsg.origin
    this.waypoint = waypointCtx
    this.destination = waypointCtx
    this.from = initMsg.from
    this.id = pendingMsg.id.toString()
    this.vaaId = pendingMsg.vaaId
  }
}

export class BasejumpUnmatched implements BasejumpJourney {
  type: BasejumpJourneyType = 'basejump.unmatched'
  originProtocol: string = 'basejump'
  destinationProtocol: string = 'basejump'
  matchingKey: string
  from: FormattedAddress
  to: FormattedAddress
  asset: string
  amount: string
  origin: MessageTerminusContext
  destination: MessageTerminus | MessageTerminusContext
  waypoint: MessageTerminusContext
  vaaId?: string
  fee?: string

  constructor(msg: BasejumpInitiated) {
    this.matchingKey = msg.matchingKey
    this.from = msg.from
    this.to = msg.to
    this.asset = msg.asset
    this.amount = msg.amount
    this.origin = msg.origin
    this.destination = msg.destination
    this.waypoint = msg.origin
    this.vaaId = msg.vaaId
    this.fee = msg.fee
  }
}

export type BasejumpMessagePayload =
  | BasejumpInitiated
  | BasejumpProcessed
  | BasejumpExecuted
  | BasejumpPending
  | BasejumpUnmatched

export type ResolvedAsset = {
  amount: string
  asset: string
  symbol?: string
  decimals?: number
  usd?: number
  role?: AssetRole
  sequence?: number
}

export type BasejumpMessagePayloadWithMetadata = BasejumpMessagePayload & {
  assets: ResolvedAsset[]
}

export function isBasejumpProcessed(obj: any): obj is BasejumpProcessed {
  return 'vaaId' in obj && 'payload' in obj && 'guardianSet' in obj
}
