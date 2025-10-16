import { z } from 'zod'
import { $NetworkString } from '@/common/types.js'

import { $NetworkString } from '@/common/types.js'
import { $BaseJourneyFilters, $JourneyProtocols, $JourneyStatus } from './queries.js'

/**
 * @public
 */
export const $XcServerSentEventArgs = $BaseJourneyFilters
  .extend({
    assets: z.optional(z.union([z.string(), z.array(z.string()).min(1).max(50)])),
    origins: z.optional(z.union([$NetworkString, z.array($NetworkString).min(1).max(50)])),
    destinations: z.optional(z.union([$NetworkString, z.array($NetworkString).min(1).max(50)])),
    networks: z.optional(z.union([$NetworkString, z.array($NetworkString).min(1).max(50)])),
    protocols: z.optional(z.union([$JourneyProtocols, z.array($JourneyProtocols).min(1).max(2)])),
    status: z.optional(z.union([$JourneyStatus, z.array($JourneyStatus).min(1).max(4)])),
    actions: z.optional(z.union([z.string(), z.array(z.string()).min(1).max(5)])),
    id: z.optional(z.string()),
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

/**
 * @public
 */
export type XcServerSentEventArgs = z.infer<typeof $XcServerSentEventArgs>
