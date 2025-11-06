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
  specVersion?: number
  timestamp?: number
  txHash?: HexString
  txHashSecondary?: HexString
}

export type HyperbridgePostRequest = {
  source: NetworkURN
  destination: NetworkURN
  nonce: string
  commitment: HexString
  from: HexString
  to: HexString
  timeout: number
  body: HexString
}

export type FormattedAddress = {
  key: HexString
  formatted?: string
}

export type HyperbridgePostRequestWithContext = HyperbridgeContext & HyperbridgePostRequest

export type HyperbridgeTerminusContext = HyperbridgeTerminus & HyperbridgeContext

export type HyperbridgeJourneyType = 'ismp.dispatched' | 'ismp.received'

export interface HyperbridgeJourney {
  type: HyperbridgeJourneyType
  originProtocol: string
  destinationProtocol: string
  origin: HyperbridgeTerminusContext
  destination: HyperbridgeTerminus | HyperbridgeTerminusContext
  from: FormattedAddress
  to: FormattedAddress
  commitment: HexString
  nonce: string
  body: HexString
  decoded?: AssetTeleport | Transact
}

abstract class BaseHyperbridgeJourney {
  originProtocol: string = 'hyperbridge'
  destinationProtocol: string = 'hyperbridge'
  origin: HyperbridgeTerminusContext
  destination: HyperbridgeTerminus | HyperbridgeTerminusContext
  from: FormattedAddress
  to: FormattedAddress
  commitment: HexString
  nonce: string
  body: HexString

  constructor(req: HyperbridgePostRequestWithContext) {
    this.origin = {
      chainId: req.source,
      blockHash: req.blockHash,
      blockNumber: req.blockNumber,
      timestamp: req.timestamp,
      txHash: req.txHash,
      txPosition: req.txPosition,
      specVersion: req.specVersion,
      event: req.event,
    }
    this.destination = {
      chainId: req.destination,
    }
    this.commitment = req.commitment
    this.nonce = req.nonce
    this.body = req.body
    this.from = toFormattedAddresses(req.from)
    this.to = toFormattedAddresses(req.to)
  }
}

export class HyperbridgeDispatched extends BaseHyperbridgeJourney implements HyperbridgeJourney {
  type: HyperbridgeJourneyType = 'ismp.dispatched'
  decoded?: AssetTeleport | Transact

  constructor(req: HyperbridgePostRequestWithContext, action?: AssetTeleport | Transact) {
    super(req)

    if (action && isAssetTeleport(action)) {
      this.from = toFormattedAddresses(action.from)
      this.to = toFormattedAddresses(action.to)
    }
    this.decoded = action
  }
}
