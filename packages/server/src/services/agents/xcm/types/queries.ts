import { $NetworkString } from '@/common/types.js'
import { z } from 'zod'

export const $TimeSelect = z.object({
  bucket: z.optional(
    z.enum(['10 minutes', '30 minutes', '1 hours', '6 hours', '12 hours', '1 days', '3 days', '7 days']),
  ),
  timeframe: z.enum(['1 days', '7 days', '15 days', '1 months', '3 months', '4 months']),
})

export const $TimeAndMaybeNetworkSelect = $TimeSelect.merge(
  z.object({
    network: z.optional($NetworkString),
  }),
)

export const $TimeAndNetworkSelect = $TimeSelect.merge(
  z.object({
    network: $NetworkString,
  }),
)

export const $AssetSelect = z.object({
  asset: z.string(),
})

export const $JourneyFilters = z
  .object({
    assets: z.optional(z.array(z.string()).min(1).max(50)),
    origins: z.optional(z.array($NetworkString).min(1).max(50)),
    destinations: z.optional(z.array($NetworkString).min(1).max(50)),
    networks: z.optional(z.array($NetworkString).min(1).max(50)),
    address: z.optional(z.string().min(3).max(100)),
    txHash: z.optional(z.string().min(3).max(100)),
    status: z.optional(
      z
        .array(z.enum(['sent', 'received', 'timeout', 'failed']))
        .min(1)
        .max(4),
    ),
    actions: z.optional(z.array(z.string()).min(1).max(4)),
    usdAmountGte: z.optional(z.number()),
    usdAmountLte: z.optional(z.number()),
  })
  .refine(
    (data) => {
      const hasNetworks = !!data.networks
      const hasOriginsOrDestinations = !!data.origins || !!data.destinations
      return !(hasNetworks && hasOriginsOrDestinations)
    },
    {
      message: '`networks` cannot be used together with `origins` or `destinations`',
      path: ['networks'], // shows the error on the networks field
    },
  )
  .optional()

export const $XcmQueryArgs = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('transfers_total'),
    criteria: $TimeAndMaybeNetworkSelect,
  }),
  z.object({
    op: z.literal('transfers_count_series'),
    criteria: $TimeSelect,
  }),
  z.object({
    op: z.literal('transfers_volume_by_asset_series'),
    criteria: $TimeAndMaybeNetworkSelect,
  }),
  z.object({
    op: z.literal('transfers_by_channel_series'),
    criteria: $TimeSelect,
  }),
  z.object({
    op: z.literal('transfers_by_network'),
    criteria: $TimeSelect,
  }),
  z.object({
    op: z.literal('transfers_series.by_network'),
    criteria: $TimeAndNetworkSelect,
  }),
  z.object({
    op: z.literal('transfers_assets_series.by_network.usd'),
    criteria: $TimeAndNetworkSelect,
  }),
  z.object({
    op: z.literal('transfers_assets_series.by_network.asset'),
    criteria: $TimeAndNetworkSelect,
  }),
  z.object({
    op: z.literal('transfers_assets_series.by_network.tx'),
    criteria: $TimeAndNetworkSelect,
  }),
  z.object({
    op: z.literal('transfers_channels_series.by_network.usd'),
    criteria: $TimeAndNetworkSelect,
  }),
  z.object({
    op: z.literal('transfers_channels_series.by_network.tx'),
    criteria: $TimeAndNetworkSelect,
  }),
  z.object({
    op: z.literal('journeys.list'),
    criteria: $JourneyFilters,
  }),
  z.object({
    op: z.literal('journeys.by_id'),
    criteria: z.object({
      id: z.string(),
    }),
  }),
  z.object({
    op: z.literal('assets.list'),
  }),
])

export type XcmQueryArgs = z.infer<typeof $XcmQueryArgs>
export type TimeSelect = z.infer<typeof $TimeSelect>
export type TimeAndMaybeNetworkSelect = z.infer<typeof $TimeAndMaybeNetworkSelect>
export type TimeAndNetworkSelect = z.infer<typeof $TimeAndNetworkSelect>
export type JourneyFilters = z.infer<typeof $JourneyFilters>
