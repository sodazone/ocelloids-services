import { z } from 'zod'
import { $NetworkString } from '@/common/types.js'

/**
 * @public
 */
export const $XcServerSentEventArgs = z
  .object({
    assets: z.optional(z.union([z.string(), z.array(z.string()).min(1).max(50)])),
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
    actions: z.optional(z.array(z.string()).min(1).max(5)),
    usdAmountGte: z.optional(z.number()),
    usdAmountLte: z.optional(z.number()),
    sentAtGte: z.optional(z.number()),
    sentAtLte: z.optional(z.number()),
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
