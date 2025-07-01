import { $NetworkString } from '@/common/types.js'
import { NetworkURN } from '@/lib.js'
import { z } from 'zod'

export const $TickerQueryArgs = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('prices'),
    criteria: z.optional(
      z.object({
        sources: z.literal('*').or(z.array(z.string()).min(1).max(50)),
      }),
    ),
  }),
  z.object({
    op: z.literal('prices.by_ticker'),
    criteria: z
      .array(
        z.object({
          ticker: z.string(),
          sources: z.optional(z.literal('*').or(z.array(z.string()).min(1).max(50))),
        }),
      )
      .min(1)
      .max(50),
  }),
  z.object({
    op: z.literal('prices.by_asset'),
    criteria: z
      .array(
        z.object({
          chainId: $NetworkString,
          assetId: z.string().or(z.number()).or(z.record(z.any())),
          sources: z.optional(z.literal('*').or(z.array(z.string()).min(1).max(50))),
        }),
      )
      .min(1)
      .max(50),
  }),
  z.object({
    op: z.literal('tickers.list'),
  }),
  z.object({
    op: z.literal('sources.list'),
  }),
])

/**
 * Data Steward query arguments.
 *
 * @public
 */
export type TickerQueryArgs = z.infer<typeof $TickerQueryArgs>

export type AssetIdentifier = {
  chainId: NetworkURN
  assetId: string | object | number
}

export type TickerPriceData = {
  ticker: string
  price: number
  updated: number
  source: string
}

export type AssetPriceData = TickerPriceData & {
  asset: AssetIdentifier | AssetIdentifier[]
}

export type AssetTickerData = {
  ticker: string
  asset: AssetIdentifier | AssetIdentifier[]
}

export type AggregatedPriceData = {
  ticker: string
  asset: AssetIdentifier | AssetIdentifier[]
  aggregatedPrice: number
  updated: number
  sources: {
    name: string
    sourcePrice: number
  }[]
}
