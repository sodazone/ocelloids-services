import { NetworkURN } from '@/lib.js'

export {
  CrosschainIssuance,
  CrosschainIssuanceInputs,
  CrosschainIssuancePayload,
} from './types.js'

/**
 * @public
 */
export type CrosschainIssuanceSubscriptionInputs = {
  reserveChain: NetworkURN
  remoteChain: NetworkURN
}

/**
 * @public
 */
export type CrosschainIssuanceQueryArgs = {
  op: 'issuance.last'
  criteria: {
    subscriptionId: string
  }
}
