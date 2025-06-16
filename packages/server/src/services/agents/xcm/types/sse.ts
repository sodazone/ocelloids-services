import { z } from 'zod'
import { $JourneyFilters } from './queries.js'

export const $XcmServerSideEventArgs = $JourneyFilters.and(
  z.object({
    id: z.number().optional(),
  }),
)

export type XcmServerSideEventArgs = z.infer<typeof $XcmServerSideEventArgs>
