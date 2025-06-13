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
    assets: z.optional(z.array(z.string()).min(1).max(50)),
    origins: z.optional(z.array($NetworkString).min(1).max(50)),
    destinations: z.optional(z.array($NetworkString).min(1).max(50)),
    address: z.optional(z.string()),
    txHash: z.optional(z.string()),
    status: z.optional(z.enum(['sent', 'received', 'timeout', 'failed'])),
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
  z.object({
    op: z.literal('journeys.by_id'),
    criteria: z.object({
      id: z.number(),
    }),
  }),
])

export type XcmQueryArgs = z.infer<typeof $XcmQueryArgs>
export type TimeSelect = z.infer<typeof $TimeSelect>
export type JourneyFilters = z.infer<typeof $JourneyFilters>
