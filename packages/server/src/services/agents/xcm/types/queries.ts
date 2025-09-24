import { z } from 'zod'

import { $NetworkString } from '@/common/types.js'

export const $TimeSelect = z.object({
  bucket: z.optional(
    z.enum([
      '10 minutes',
      '30 minutes',
      '1 hours',
      '6 hours',
      '12 hours',
      '1 days',
      '3 days',
      '7 days',
      '14 days',
      '30 days',
    ]),
  ),
  timeframe: z.enum(['1 days', '7 days', '15 days', '1 months', '3 months', '6 months', '9 months']),
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
])

export type XcmQueryArgs = z.infer<typeof $XcmQueryArgs>
export type TimeSelect = z.infer<typeof $TimeSelect>
export type TimeAndMaybeNetworkSelect = z.infer<typeof $TimeAndMaybeNetworkSelect>
export type TimeAndNetworkSelect = z.infer<typeof $TimeAndNetworkSelect>
