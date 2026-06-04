import { HexString } from '@/services/subscriptions/types.js'
import { SubstrateAccountMetadata } from '../types.js'

export type SubstrateAccountUpdate = Partial<SubstrateAccountMetadata> & {
  publicKey: HexString
  replace?: boolean
}

/**
 * Account query result data.
 *
 * @public
 */
export type SubstrateAccountResult = SubstrateAccountMetadata & {
  accountId: string
}
