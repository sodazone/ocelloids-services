import { Subscription as RxSubscription } from 'rxjs'
import z from 'zod'

import { $NetworkString } from '@/common/types.js'
import { Subscription } from '@/services/subscriptions/types.js'

export const $AssetId = z.union([
  z.string().min(1, 'asset id is required'),
  z.number().finite(),
  z.object({}).passthrough(),
])

export const $CrosschainIssuanceInput = z.object({
  reserveChain: $NetworkString,
  reserveAssetId: $AssetId,
  reserveAddress: z.string().min(42).max(66),
  reserveDecimals: z.number().min(0).max(20),

  remoteChain: $NetworkString,
  remoteAssetId: $AssetId,
  remoteDecimals: z.number().min(0).max(20),
})

export type CrosschainIssuanceInput = z.infer<typeof $CrosschainIssuanceInput>

export type CrosschainIssuance = {
  reserve: string
  remote: string
}

export type CrosschainIssuanceHandler = {
  subscription: Subscription<CrosschainIssuanceInput>
  stream: RxSubscription
}
