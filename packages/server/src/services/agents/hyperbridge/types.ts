import { HexString } from '@/lib.js'
import { AnyJson, NetworkURN } from '@/services/types.js'
import { toFormattedAddresses } from './ops/common.js'

export type SubstratePostRequestEvent = {
  dest_chain: {
    type: string
    value: number
  }
  source_chain: {
    type: string
    value: number
  }
  request_nonce: bigint
  commitment: HexString
}

export type SubstrateHandlePostRequestBody = {
  source: {
    type: string
    value: number
  }
  dest: {
    type: string
    value: number
  }
  nonce: string
  from: HexString
  to: HexString
  timeout_timestamp: string
  body: HexString
}

export type SubstrateHandleUnsignedRequestObject = {
  requests: SubstrateHandlePostRequestBody[]
  proof: Record<string, any>
  signer: HexString
}

export type SubstratePostRequestTimeout = {
  type: 'Post'
  value: {
    requests: {
      type: string
      value: SubstrateHandlePostRequestBody
    }[]
    timeout_proof: any
  }
}

export type SubstrateHandleUnsignedTimeoutObject =
  | SubstratePostRequestTimeout
  | {
      type: 'Get'
      value: any
    }

export type SubstrateHandleUnsignedMessage =
  | {
      type: 'Request'
      value: SubstrateHandleUnsignedRequestObject
    }
  | {
      type: 'Consensus'
      value: any
    }
  | {
      type: 'Timeout'
      value: SubstrateHandleUnsignedTimeoutObject
    }

export type SubstrateHandleUnsignedArgs = {
  messages: SubstrateHandleUnsignedMessage[]
}

export type EvmHandlePostRequestBody = {
  source: HexString
  dest: HexString
  nonce: string
  from: HexString
  to: HexString
  timeoutTimestamp: string
  body: HexString
}

export type EvmHandlePostRequestArgs = [
  HexString,
  {
    proof: any
    requests: {
      request: EvmHandlePostRequestBody
      index: string
      kIndex: string
    }[]
  },
]

export type EvmHandlePostRequestTimeoutArgs = [
  HexString,
  {
    proof: any
    height: { stateMachineId: string; height: string }
    timeouts: EvmHandlePostRequestBody[]
  },
]

export type EvmPostRequestEvent = {
  source: string
  dest: string
  from: HexString
  to: HexString
  nonce: bigint
  timeoutTimestamp: bigint
  body: HexString
  fee: bigint
}

export type SubstrateOffchainRequest = {
  source: string // "POLKADOT-2030"
  dest: string // "EVM-8453"
  nonce: number
  from: HexString
  to: HexString
  timeoutTimestamp: number
  body: HexString
}

export type IsmpQueryRequestRpcResult = {
  Post: SubstrateOffchainRequest
}

export type AssetTeleportRequest = {
  amount: bigint
  assetId: HexString
  redeem: boolean
  from: HexString
  to: HexString
  data?: HexString
}

export type TokenGatewayActions =
  | 'incoming-asset'
  | 'governance-action'
  | 'create-asset'
  | 'deregister-asset'
  | 'change-asset-admin'
  | 'new-contract-instance'

export type AssetTeleport = AssetTeleportRequest & {
  action: TokenGatewayActions
}

export function isAssetTeleport(obj: any): obj is AssetTeleport {
  return 'assetId' in obj && 'amount' in obj && 'action' in obj
}

export type Transact = {
  method: string
  args?: Record<string, unknown> | readonly unknown[]
}

export interface HyperbridgeTerminus {
  chainId: NetworkURN
}

export type HyperbridgeContext = {
  event?: AnyJson
  txPosition?: number
  blockNumber: string | number
  blockHash: HexString
  outcome: 'Success' | 'Fail'
  specVersion?: number
  timestamp?: number
  txHash?: HexString
  txHashSecondary?: HexString
}

export type IsmpPostRequest = {
  chainId: NetworkURN
  source: NetworkURN
  destination: NetworkURN
  nonce: string
  commitment: HexString
  from: HexString
  to: HexString
  timeoutAt: number
  body: HexString
}

export type IsmpPostRequestHandled = {
  relayer?: HexString
  type: 'Received' | 'Timeout'
  outcome: 'Success' | 'Fail'
}

export type IsmpPostRequestWithContext = HyperbridgeContext & IsmpPostRequest

export type IsmpPostRequestHandledWithContext = HyperbridgeContext & IsmpPostRequest & IsmpPostRequestHandled

export type HyperbridgeTerminusContext = HyperbridgeTerminus & HyperbridgeContext

export type FormattedAddress = {
  key: HexString
  formatted?: string
}

export type HyperbridgeJourneyType = 'ismp.dispatched' | 'ismp.relayed' | 'ismp.received'

export interface HyperbridgeJourney {
  type: HyperbridgeJourneyType
  originProtocol: string
  destinationProtocol: string
  waypoint: HyperbridgeTerminusContext
  origin: HyperbridgeTerminusContext
  destination: HyperbridgeTerminus | HyperbridgeTerminusContext
  from: FormattedAddress
  to: FormattedAddress
  commitment: HexString
  nonce: string
  body: HexString
  timeoutAt: number
  decoded?: AssetTeleport | Transact
}

abstract class BaseHyperbridgeJourney {
  originProtocol: string = 'hyperbridge'
  destinationProtocol: string = 'hyperbridge'
  from: FormattedAddress
  to: FormattedAddress
  commitment: HexString
  nonce: string
  body: HexString
  timeoutAt: number

  constructor(req: IsmpPostRequest) {
    this.commitment = req.commitment
    this.nonce = req.nonce
    this.body = req.body
    this.timeoutAt = req.timeoutAt
    this.from = toFormattedAddresses(req.from)
    this.to = toFormattedAddresses(req.to)
  }
}

export class HyperbridgeDispatched extends BaseHyperbridgeJourney implements HyperbridgeJourney {
  type: HyperbridgeJourneyType = 'ismp.dispatched'
  origin: HyperbridgeTerminusContext
  destination: HyperbridgeTerminus | HyperbridgeTerminusContext
  waypoint: HyperbridgeTerminusContext
  decoded?: AssetTeleport | Transact

  constructor(req: IsmpPostRequestWithContext, action?: AssetTeleport | Transact) {
    super(req)

    this.origin = {
      chainId: req.source,
      blockHash: req.blockHash,
      blockNumber: req.blockNumber,
      timestamp: req.timestamp,
      txHash: req.txHash,
      txPosition: req.txPosition,
      specVersion: req.specVersion,
      event: req.event,
      outcome: 'Success',
    }
    this.waypoint = this.origin
    this.destination = {
      chainId: req.destination,
    }

    if (action && isAssetTeleport(action)) {
      this.from = toFormattedAddresses(action.from)
      this.to = toFormattedAddresses(action.to)
    }
    this.decoded = action
  }
}

export class HyperbridgeRelayed extends BaseHyperbridgeJourney implements HyperbridgeJourney {
  type: HyperbridgeJourneyType = 'ismp.relayed'
  origin: HyperbridgeTerminusContext
  destination: HyperbridgeTerminus | HyperbridgeTerminusContext
  waypoint: HyperbridgeTerminusContext
  decoded?: AssetTeleport | Transact

  constructor(dispatchMsg: HyperbridgeDispatched, relayMsg: IsmpPostRequestWithContext) {
    super(relayMsg)

    this.origin = dispatchMsg.origin
    this.waypoint = {
      chainId: relayMsg.chainId,
      blockHash: relayMsg.blockHash,
      blockNumber: relayMsg.blockNumber,
      timestamp: relayMsg.timestamp,
      txHash: relayMsg.txHash,
      txPosition: relayMsg.txPosition,
      specVersion: relayMsg.specVersion,
      event: relayMsg.event,
      outcome: 'Success',
    }
    this.destination = dispatchMsg.destination

    this.from = dispatchMsg.from
    this.to = dispatchMsg.to
    this.decoded = dispatchMsg.decoded
  }
}
