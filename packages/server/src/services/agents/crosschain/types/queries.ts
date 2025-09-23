import { z } from 'zod'

import { $NetworkString } from '@/common/types.js'

export const $JourneyFilters = z
  .object({
    assets: z.optional(z.array(z.string()).min(1).max(50)),
    origins: z.optional(z.array($NetworkString).min(1).max(50)),
    destinations: z.optional(z.array($NetworkString).min(1).max(50)),
    networks: z.optional(z.array($NetworkString).min(1).max(50)),
    address: z.optional(z.string().min(3).max(100)),
    txHash: z.optional(z.string().min(3).max(100)),
    protocols: z.optional(z.array(z.enum(['xcm', 'wormhole_portal'])).min(1)),
    status: z.optional(
      z
        .array(z.enum(['sent', 'received', 'timeout', 'failed']))
        .min(1)
        .max(4),
    ),
    actions: z.optional(z.array(z.string()).min(1).max(5)),
    usdAmountGte: z.optional(z.number()),
    usdAmountLte: z.optional(z.number()),
    sentAtGte: z.optional(z.number()),
    sentAtLte: z.optional(z.number()),
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

export const $XcQueryArgs = z.discriminatedUnion('op', [
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

export type JourneyFilters = z.infer<typeof $JourneyFilters>
export type XcQueryArgs = z.infer<typeof $XcQueryArgs>
