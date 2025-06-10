import { $NetworkString } from '@/common/types.js'
import { z } from 'zod'

export const $TimeSelect = z.object({
  bucket: z.optional(
    z.enum(['10 minutes', '30 minutes', '1 hours', '6 hours', '12 hours', '1 days', '7 days']),
  ),
  timeframe: z.enum(['1 days', '7 days', '15 days', '1 months', '4 months']),
})

export const $AssetSelect = z.object({
  asset: z.string(),
})

export const $JourneyFilters = z.optional(
  z.object({
    asset: z.optional(z.array(z.string())),
    origin: z.optional(z.array(z.string())),
  }),
)

export const $XcmQueryArgs = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('transfers_total'),
    criteria: $TimeSelect,
  }),
  z.object({
    op: z.literal('transfers_count_series'),
    criteria: $TimeSelect,
  }),
  z.object({
    op: z.literal('transfers_volume_by_asset_series'),
    criteria: $TimeSelect.merge(
      z.object({
        network: z.optional($NetworkString),
      }),
    ),
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
    op: z.literal('journeys.list'),
    criteria: $JourneyFilters,
  }),
])

export type XcmQueryArgs = z.infer<typeof $XcmQueryArgs>
export type TimeSelect = z.infer<typeof $TimeSelect>
export type JourneyFilters = z.infer<typeof $JourneyFilters>
