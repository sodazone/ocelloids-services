import { sourceIssuance } from '../server-types'

/**
 * @public
 */
export type CrosschainIssuancePayload = sourceIssuance.CrosschainIssuancePayload

/**
 * @public
 */
export type CrosschainIssuanceQueryArgs = sourceIssuance.CrosschainIssuanceQueryArgs

/**
 * @public
 */
export type CrosschainIssuanceSubscriptionInputs = {
  reserveChain: string
  remoteChain: string
}
