import z from 'zod'
import { $NetworkString } from '@/common/types.js'
import { AssetMetadata, Empty, SubstrateAccountMetadata } from '../steward/types.js'

/**
 * @public
 */
export const DEFI_EVENT_NAMES = ['swap', 'mint', 'burn'] as const

/**
 * @private
 */
const $LiquidityFilters = z.object({
  protocols: z.literal('*').or(z.array(z.string())).optional(),
})

/**
 * @private
 */
const $EventFilters = z.object({
  events: z
    .literal('*')
    .or(z.array(z.enum(DEFI_EVENT_NAMES)))
    .optional(),
})

/**
 * @private
 */
export const $DefiAgentInputs = z.discriminatedUnion('topic', [
  z.object({
    topic: z.literal('liquidity'),
    networks: z.literal('*').or(z.array($NetworkString)),
    filters: $LiquidityFilters.optional(),
  }),
  z.object({
    topic: z.literal('event'),
    networks: z.literal('*').or(z.array($NetworkString)),
    filters: $EventFilters.optional(),
  }),
])

/**
 * @private
 */
export type DefiAgentInputs = z.infer<typeof $DefiAgentInputs>

/**
 * @private
 */
export const $DefiOrderStatus = z.enum(['placed', 'partially_filled', 'filled', 'cancelled', 'expired'])

export const $DefiOrderFilters = z
  .object({
    networks: z.optional(z.array($NetworkString).min(1).max(50)),
    protocols: z.optional(z.array(z.string()).min(1).max(6)),
    status: z.optional(z.array($DefiOrderStatus).min(1).max(4)),
    address: z.optional(z.string().min(3).max(100)),
    usdAmountGte: z.optional(z.number()),
    usdAmountLte: z.optional(z.number()),
  })
  .optional()

/**
 * @private
 */
export const $DefiAgentQueryArgs = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('liquidity.last'),
    criteria: z.object({
      networks: z.literal('*').or(z.array($NetworkString)).optional(),
    }),
  }),
  z.object({
    op: z.literal('events'),
    criteria: z
      .object({
        networks: z.literal('*').or(z.array($NetworkString)).optional(),
        filters: $EventFilters.optional(),
      })
      .optional(),
  }),
  z.object({
    op: z.literal('price.last'),
    criteria: z.object({ networks: z.literal('*').or(z.array($NetworkString)).optional() }),
  }),
  z.object({
    op: z.literal('orders.list'),
    criteria: $DefiOrderFilters,
  }),
])

/**
 * @private
 */
export type DefiAgentQueryArgs = z.infer<typeof $DefiAgentQueryArgs>

/**
 * @private
 */
export type DefiOrderFilters = z.infer<typeof $DefiOrderFilters>

/**
 * @public
 */
export type DefiLiquidityAsset = {
  assetId: string
  symbol: string
  decimals: number

  priceUSD: number

  balances: {
    total?: string // total liquidity
    available?: string // cash (lending)
    borrowed?: string // lending
    holdingCap?: string // stability collateral cap
    mintCap?: string // stability debt cap
    reserves: string
  }

  role?: 'liquid' | 'collateral' | 'debt'
}

/**
 * @public
 */
export type MoneyMarketPayload = Partial<{
  utilization: number
  borrowedUSD: number
  borrowAPR: number
  supplyAPR: number
  isPaused: boolean
  canBorrow: boolean
  borrowCap: string
  supplyCap: string
  health: {
    solvencyRatio: number
    tokenDeficitUSD?: number
  }
}>

/**
 * @public
 */
export type DefiLiquidityCategory = 'exchange' | 'money-market' | 'stability'

/**
 * @public
 */
export type DefiLiquidityPayload = {
  type: 'liquidity'
  category: DefiLiquidityCategory

  networkId: string
  protocol: string
  marketId: string

  suppliedUSD: number

  assets: DefiLiquidityAsset[]

  lending?: MoneyMarketPayload
}

/**
 * @public
 */
export type DefiEventName = (typeof DEFI_EVENT_NAMES)[number]

/**
 * @public
 */
export type DefiEventAsset = {
  assetId: string
  symbol: string
  amount: string
  amountUSD?: number
}

/**
 * @public
 */
export type DefiOrderStatus = 'placed' | 'partially_filled' | 'filled' | 'cancelled' | 'expired'

/**
 * @public
 */
export type MoneyMarketActions = 'borrow' | 'repay' | 'withdraw' | 'supply'

/**
 * @public
 */
export type DefiEventPayload = {
  type: 'event'
  id: string
  marketId: string
  protocol: string
  networkId: string
  blockHash: string | null
  blockNumber: string | null
  txHash: string | null
} & (
  | {
      name: 'swap'
      data: {
        origin: string
        in: DefiEventAsset
        out: DefiEventAsset
      }
    }
  | {
      name: 'mint' | 'burn'
      data: {
        provider: string
        assets: DefiEventAsset[]
      }
    }
  | {
      name: MoneyMarketActions
      data: {
        provider: string
        assets: DefiEventAsset[]
      }
    }
  | {
      name: 'liquidate'
      data: {
        origin: string
        counterparty: string
        debt: DefiEventAsset
        collateral: DefiEventAsset
      }
    }
)

/**
 * @public
 */
export type DefiEventAction =
  | MoneyMarketActions
  | 'liquidate'
  | 'mint'
  | 'burn'
  | 'swap'
  | 'swap_intent'
  | 'swap_fill'

/**
 * @public
 */
export type DefiPricePayload = {
  type: 'price'
  networkId: string
  protocol: string
  assetId: string
  symbol: string
  decimals: number
  priceUSD: string
  updatedAt: number
}

/**
 * @public
 */
export type DefiOrderPayload = {
  type: 'order'
  networkId: string
  protocol: string
  orderId: string
  owner: string
  status: DefiOrderStatus
  blockNumber: string
  timestamp: number

  creation?: {
    assetIn: string
    assetOut: string
    symbolIn: string
    symbolOut: string
    createdAtBlock: string
    createdAt: number
    blockHash: string
    txHash?: string
    amountIn?: string
    amountOut?: string
  }

  fill?: {
    filler: string
    assetIn: string
    assetOut: string
    symbolIn: string
    symbolOut: string
    amountIn: string
    amountOut: string
    amountUSD?: string
    blockNumber: string
    blockHash: string
    eventIndex: number
    timestamp: number
    txHash?: string
  }
}

export type DefiOrder = {
  id: number
  networkId: string
  protocol: string
  orderId: string
  orderKey: string
  owner: string

  assetIn: string
  assetOut: string
  symbolIn: string
  symbolOut: string
  amountIn: string | null
  amountOut: string | null
  fillCount: number
  filledAmountIn: string
  filledAmountOut: string
  filledAmountUsd: string

  status: string

  created?: {
    txHash: string | null
    blockNumber: string
    blockHash: string
    timestamp: number
  }

  updated: {
    blockNumber: string | null
    timestamp: number
  }
}

/**
 * @public
 */
export type DefiSubscriptionPayload =
  | DefiEventPayload
  | DefiLiquidityPayload
  | DefiPricePayload
  | DefiOrderPayload

export function isOrder(payload: DefiSubscriptionPayload): payload is DefiOrderPayload {
  return payload.type === 'order'
}

export function isSwapEvent(
  payload: DefiSubscriptionPayload,
): payload is Extract<DefiEventPayload, { name: 'swap' }> {
  return payload.type === 'event' && payload.name === 'swap'
}

export function isLiquidationEvent(
  payload: DefiSubscriptionPayload,
): payload is Extract<DefiEventPayload, { name: 'liquidate' }> {
  return payload.type === 'event' && payload.name === 'liquidate'
}

export type DefiMonitorDependencies = {
  fetchAccounts: (accounts: string[]) => Promise<(SubstrateAccountMetadata | Empty)[]>
  fetchAssetMetadata: (network: string, assets: string[]) => Promise<AssetMetadata[]>
  listLatestPrices: (network: string) => Promise<DefiPricePayload[]>
}
