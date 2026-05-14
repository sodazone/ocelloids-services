import z from 'zod'
import { $NetworkString } from '@/common/types.js'

/**
 * @public
 */
export const DEFI_EVENT_NAMES = ['swap', 'mint', 'burn'] as const

/**
 * @private
 */
const $LiquidityFilters = z.object({
  dex: z.array(z.string()).optional(),
})

/**
 * @private
 */
const $EventFilters = z.object({
  type: z.enum(DEFI_EVENT_NAMES).optional(),
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
    reserves: string
  }

  role?: 'liquid' | 'collateral' | 'debt'
}

/**
 * @public
 */
export type DefiLiquidityPayload = {
  type: 'liquidity'
  category: 'exchange' | 'money-market'

  protocol: string
  marketId: string

  tvlUSD: number

  assets: DefiLiquidityAsset[]

  lending?: Partial<{
    utilization: number
    borrowAPR: number
    supplyAPR: number
    isPaused: boolean
    canBorrow: boolean
    borrowCap: string
    health: {
      solvencyRatio: number
      badDebtUSD?: number
    }
  }>
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
export type DefiEventPayload = {
  type: 'event'
  marketId: string
  protocol: string
  networkId: string
  blockNumber: string
  txHash: string
} & (
  | {
      name: 'swap'
      data: {
        origin: string
        in: DefiEventAsset[]
        out: DefiEventAsset[]
      }
    }
  | {
      name: 'mint' | 'burn' | 'liquidate'
      data: {
        provider: string
        assets: DefiEventAsset[]
        lpAmount?: string
      }
    }
  | {
      name: 'borrow' | 'repay'
      data: {
        provider: string
        assets: DefiEventAsset[]
      }
    }
)

export type DefiEventAction = 'mint' | 'burn' | 'borrow' | 'repay' | 'liquidate' | 'swap'

/**
 * @public
 */
export type DefiSubscriptionPayload = DefiEventPayload | DefiLiquidityPayload
