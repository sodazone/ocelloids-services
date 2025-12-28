import { AnyJson } from '@/lib.js'
import { AssetRole } from '@/services/agents/crosschain/index.js'
import { NetworkURN } from '@/services/types.js'

export type XcmV3MultiLocation = AnyJson

/**
 * @public
 */
export type XcmAssetWithMetadata = {
  id: string
  symbol?: string
  amount: bigint
  decimals?: number
  role?: AssetRole
  sequence?: number
}

export type QueryableXcmAsset = {
  location: string
  amount: bigint
  role?: AssetRole
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

export type InitiateReserveWithdraw = {
  assets: MultiAsset[]
  reserve: AnyJson
  xcm: XcmInstruction[]
}

export type InitiateTeleport = {
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

export type InitiateTransfer = {
  destination: AnyJson
  remote_fees: AnyJson
  preserve_origin: boolean
  assets: AnyJson[]
  remote_xcm: XcmInstruction[]
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
export type HumanizedXcmAsset = XcmAssetWithMetadata & {
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
  assets: HumanizedXcmAsset[]
  version?: string
  transactCalls: HumanizedTransactCall[]
  xprotocolData?: XprotocolData
}

export function isConcrete(object: any): object is Concrete {
  return object.type !== undefined || object.type === 'Concrete'
}

/**
 * @public
 */
export type XprotocolData = {
  type: string
  protocol: string
  destination: NetworkURN
  beneficiary: HumanizedAddresses
  assets: HumanizedXcmAsset[]
}
