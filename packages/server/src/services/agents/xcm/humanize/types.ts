import { AnyJson } from '@/lib.js'

export type XcmV3MultiLocation = AnyJson

export type XcmAssetWithMetadata = {
  id: string
  symbol: string
  amount: bigint
  decimals: number
}

export type QueryableXcmAsset = {
  location: AnyJson
  amount: bigint
}

type Concrete = {
  type: 'Concrete'
  value: XcmV3MultiLocation
}
type Abstract = {
  type: 'Abstract'
  value: string
}

export interface MultiAsset {
  id: Concrete | Abstract | XcmV3MultiLocation
  fun: {
    type: string
    value: string
  }
}

type InitiateReserveWithdraw = {
  assets: MultiAsset[]
  reserve: AnyJson
  xcm: XcmInstruction[]
}

type InitiateTeleport = {
  assets: MultiAsset[]
  dest: AnyJson
  xcm: XcmInstruction[]
}

type DepositReserveAsset = InitiateTeleport
type TransferReserveAsset = InitiateTeleport

export type HopTransfer =
  | InitiateTeleport
  | DepositReserveAsset
  | TransferReserveAsset
  | InitiateReserveWithdraw

export type ExportMessage = {
  network?: { type: string; value: AnyJson }
  destination?: { type: string; value: AnyJson }
  xcm: XcmInstruction[]
}

export type Transact = {
  call: string
  origin_kind: string
  require_weight_at_most: AnyJson
}

type AccountId32 = {
  type: 'AccountId32'
  value: {
    id: string
  }
}

type AccountKey20 = {
  type: 'AccountKey20'
  value: {
    key: string
  }
}

type Parachain = {
  type: 'Parachain'
  value: string
}

export type DepositAsset = {
  beneficiary: {
    interior: {
      type: string
      value: AccountId32 | AccountKey20 | Parachain
    }
  }
}

export type XcmInstruction = {
  type: string
  value: AnyJson
}

export type XcmVersionedInstructions = {
  type: string
  value: XcmInstruction[]
}

export enum XcmJourneyType {
  Transfer = 'transfer',
  Teleport = 'teleport',
  Transact = 'transact',
  QueryResponse = 'queryResponse',
  Unknown = '??',
}

export type XcmAsset = XcmAssetWithMetadata & {
  volume?: number
}

export type HumanizedXcm = {
  type: XcmJourneyType
  to: string
  from: string
  assets: XcmAsset[]
  version?: string
  transactCall?: string
}

export function isConcrete(object: any): object is Concrete {
  return object.type !== undefined || object.type === 'Concrete'
}
