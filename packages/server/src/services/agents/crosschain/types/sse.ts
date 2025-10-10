import { z } from 'zod'

import { $RawJourneyFilters } from './queries.js'

/**
 * @public
 */
export const $XcServerSentEventArgs = $RawJourneyFilters
  .extend({
    id: z.string().optional(),
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
