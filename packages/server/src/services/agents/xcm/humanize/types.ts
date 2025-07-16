import { AnyJson } from '@/lib.js'
import { XcmAssetRole } from '../explorer/repositories/types.js'

export type XcmV3MultiLocation = AnyJson

/**
 * @public
 */
export type XcmAssetWithMetadata = {
  id: string
  symbol?: string
  amount: bigint
  decimals?: number
  role?: XcmAssetRole
  sequence?: number
}

export type QueryableXcmAsset = {
  location: string
  amount: bigint
  role?: XcmAssetRole
  sequence?: number
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

type DefiniteMultiAssetFilter = {
  type: 'Definite'
  value: MultiAsset[]
}

type WildMultiAsset =
  | {
      type: 'All'
    }
  | {
      type: 'AllOf'
      value: {
        id: Concrete | Abstract
        fun: {
          type: string
        }
      }
    }
  | {
      type: 'AllCounted'
      value: string
    }
  | {
      type: 'AllOfCounted'
      value: {
        id: Concrete | Abstract
        fun: {
          type: string
        }
        count: string
      }
    }

type WildMultiAssetFilter = {
  type: 'Wild'
  value: WildMultiAsset
}

export type MultiAssetFilter = WildMultiAssetFilter | DefiniteMultiAssetFilter

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

export type ExchangeAsset = {
  give: MultiAssetFilter
  want: MultiAsset[]
  maximal: boolean
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

/**
 * @public
 */
export enum XcmJourneyType {
  Transfer = 'transfer',
  Teleport = 'teleport',
  Transact = 'transact',
  QueryResponse = 'queryResponse',
  Swap = 'swap',
  Unknown = '??',
}

/**
 * @public
 */
export type XcmAsset = XcmAssetWithMetadata & {
  volume?: number
}

/**
 * @public
 */
export type HumanizedAddresses = {
  key: string
  formatted?: string
}

/**
 * @public
 */
export type HumanizedTransactCall = {
  raw: string
  module?: string
  method?: string
  args?: AnyJson
}

/**
 * @public
 */
export type HumanizedXcm = {
  type: XcmJourneyType
  to: HumanizedAddresses
  from: HumanizedAddresses
  assets: XcmAsset[]
  version?: string
  transactCalls: HumanizedTransactCall[]
}

export function isConcrete(object: any): object is Concrete {
  return object.type !== undefined || object.type === 'Concrete'
}
