import { AnyJson } from '@/lib.js'
import { z } from 'zod'

export type XcmVersion = 'v2' | 'v3' | 'v4'

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
  xcm: XcmInstruction[]
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

type XcmInstruction = {
  type: string
  value: AnyJson
}

export type XcmVersionedInstructions = {
  type: string
  value: XcmInstruction[]
}

export type XcmTransfer = {
  id: number
  correlationId: string
  sentAt: number
  recvAt: number
  asset: string
  symbol: string
  decimals: number
  amount: bigint
  origin: string
  destination: string
  from: string
  to: string
}

export type NewXcmTransfer = Omit<XcmTransfer, 'id'>

export function isConcrete(object: any): object is Concrete {
  return object.type !== undefined || object.type === 'Concrete'
}

export const $XcmQueryArgs = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('total_transfers'),
    /*criteria: z.array(
      z.object({
        network: $NetworkString,
        assets: z.array(z.string()).min(1).max(50),
      }),
    ),*/
  }),
  z.object({
    op: z.literal('transfers'),
  }),
])

export type XcmQueryArgs = z.infer<typeof $XcmQueryArgs>
