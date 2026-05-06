import z from 'zod'
import { $NetworkString } from '@/common/types.js'

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
  type: z.enum(['swap', 'mint', 'burn']).optional(),
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
    topic: z.literal('events'),
    networks: z.literal('*').or(z.array($NetworkString)),
    filters: $EventFilters.optional(),
  }),
])

/**
 * @private
 */
export type DefiAgentInputs = z.infer<typeof $DefiAgentInputs>

export type DefiLiquidityAsset = {
  assetId: string
  symbol: string
  decimals: number

  priceUSD: number

  balances: {
    total?: string // total liquidity (DEX or supplied)
    available?: string // cash (lending)
    borrowed?: string // lending
  }

  role?: 'liquid' | 'collateral' | 'debt'
}

export type DefiLiquidityPayload = {
  type: 'liquidity'
  category: 'exchange' | 'money-market'

  protocol: string
  marketId: string

  tvlUSD: number

  assets: DefiLiquidityAsset[]

  lending?: {
    utilization?: number
    borrowAPR?: number
    supplyAPR?: number
  }
}

export type DefiEventPayload = {
  type: 'event'
  name: 'swap' | 'burn' | 'mint'
}

export type DefiSubscriptionPayload = DefiEventPayload | DefiLiquidityPayload
