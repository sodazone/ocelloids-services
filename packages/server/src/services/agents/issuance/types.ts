import { Subscription as RxSubscription } from 'rxjs'
import z from 'zod'

import { $NetworkString } from '@/common/types.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'

/**
 * @private
 */
export const $AssetId = z.union([z.string().min(1, 'asset id is required'), z.number(), z.object({}).loose()])

/**
 * @private
 */
export const $CrosschainIssuanceSubscriptionInputs = z.object({
  reserveChain: $NetworkString,
  remoteChain: $NetworkString,
})

/**
 * @private
 */
export type CrosschainIssuanceSubscriptionInputs = z.infer<typeof $CrosschainIssuanceSubscriptionInputs>

/**
 * @private
 */
export const $CrosschainIssuanceQueryArgs = z.object({
  op: z.literal('issuance.last'),
  criteria: z.object({
    subscriptionId: z.string(),
  }),
})

/**
 * @private
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
  inputs: {
    reserveChain: NetworkURN
    reserveAssetId: string
    reserveAddress: string
    reserveDecimals: number
    remoteChain: NetworkURN
    remoteAssetId: string
    remoteDecimals: number
    assetSymbol: string
  }
}

export type CrosschainIssuanceHandler = {
  subscription: Subscription<CrosschainIssuanceSubscriptionInputs>
  stream: RxSubscription
}

/**
 * @public
 */
export type CrosschainIssuanceInputs = {
  reserveChain: NetworkURN
  reserveAssetId: string | number | Record<string, any>
  reserveAddress: string
  reserveDecimals: number
  remoteChain: NetworkURN
  remoteAssetId: string | number | Record<string, any>
  remoteDecimals: number
  assetSymbol: string
}
