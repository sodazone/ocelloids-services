import { Subscription as RxSubscription } from 'rxjs'
import z from 'zod'
import { ControlQuery } from '@/common/index.js'
import { $NetworkString } from '@/common/types.js'
import { uniqueArray } from '@/common/util.js'
import { HexString, Subscription } from '@/services/subscriptions/types.js'
import { AnyJson, NetworkURN } from '@/services/types.js'

export const $TransfersAgentInputs = z.object({
  networks: z.literal('*').or(z.array($NetworkString).transform(uniqueArray)),
})

export type TransfersAgentInputs = z.infer<typeof $TransfersAgentInputs>

/**
 * @public
 */

export const $IcTransferType = z.enum(['user', 'mixed', 'system'])

export const $TransfersFilters = z.object({
  types: z.optional(z.array($IcTransferType).min(1).max(3)),
  networks: z.optional(z.array($NetworkString).min(1).max(50).transform(uniqueArray)),
  assets: z.optional(z.array(z.string()).min(1).max(50)),
  address: z.optional(z.string().min(3).max(100)),
  txHash: z.optional(z.string().min(3).max(100)),
  usdAmountGte: z.optional(z.number()),
  usdAmountLte: z.optional(z.number()),
  sentAtGte: z.optional(z.number()),
  sentAtLte: z.optional(z.number()),
})

export const $TransferRangeFilters = z.object({
  start: z.number(),
  end: z.number(),
  networks: z.optional(z.array($NetworkString).min(1).max(50).transform(uniqueArray)),
})

export const $IcTransferQueryArgs = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('transfers.list'),
    criteria: $TransfersFilters,
  }),
  z.object({
    op: z.literal('transfers.by_id'),
    criteria: z.object({
      id: z.number(),
    }),
  }),
  z.object({
    op: z.literal('transfers.by_id_range'),
    criteria: $TransferRangeFilters,
  }),
])

export type IcTransferQueryArgs = z.infer<typeof $IcTransferQueryArgs>
export type TransfersFilters = z.infer<typeof $TransfersFilters>
export type IcTransferType = z.infer<typeof $IcTransferType>
export type TransferRangeFilters = z.infer<typeof $TransferRangeFilters>

export type TransfersSubscriptionHandler = {
  networksControl: ControlQuery
  subscription: Subscription<TransfersAgentInputs>
  stream: RxSubscription
}

/**
 * @public
 */
export type Transfer = {
  asset: string
  from: HexString
  to: HexString
  fromFormatted: string
  toFormatted: string
  amount: string
  blockNumber: string
  blockHash: string
  timestamp?: number
  event: {
    module: string
    name: string
    blockPosition: number
    value: Record<string, any>
  }
  extrinsic?: AnyJson
}

/**
 * @public
 */
export type EnrichedTransfer = Transfer & {
  type: IcTransferType
  chainId: NetworkURN
  decimals?: number
  symbol?: string
  volume?: number
}
