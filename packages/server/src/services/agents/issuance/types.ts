import { Subscription as RxSubscription } from 'rxjs'
import z from 'zod'

import { $NetworkString } from '@/common/types.js'
import { Subscription } from '@/services/subscriptions/types.js'

/**
 * @public
 */
export const $AssetId = z.union([
  z.string().min(1, 'asset id is required'),
  z.number().finite(),
  z.object({}).passthrough(),
])

/**
 * @public
 */
export const $CrosschainIssuanceInputs = z.object({
  reserveChain: $NetworkString,
  reserveAssetId: $AssetId,
  reserveAddress: z.string().min(42).max(66),
  reserveDecimals: z.number().min(0).max(20),

  remoteChain: $NetworkString,
  remoteAssetId: $AssetId,
  remoteDecimals: z.number().min(0).max(20),

  assetSymbol: z.string(),
})

/**
 * @public
 */
export type CrosschainIssuanceInputs = z.infer<typeof $CrosschainIssuanceInputs>

/**
 * @public
 */
export const $CrosschainIssuanceQueryArgs = z.object({
  op: z.literal('issuance.last'),
  criteria: z.object({
    subscriptionId: z.string(),
  }),
})

/**
 * @public
 */
export type CrosschainIssuanceQueryArgs = z.infer<typeof $CrosschainIssuanceQueryArgs>

/**
 * @public
 */
export type CrosschainIssuance = {
  reserve: string
  remote: string
}

/**
 * @public
 */
export type CrosschainIssuancePayload = CrosschainIssuance & {
  inputs: CrosschainIssuanceInputs
}

export type CrosschainIssuanceHandler = {
  subscription: Subscription<CrosschainIssuanceInputs>
  stream: RxSubscription
}
