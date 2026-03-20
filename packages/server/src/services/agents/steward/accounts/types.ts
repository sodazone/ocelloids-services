import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'

/**
 * Account identity data.
 *
 * @public
 */
export type AccountIdentity = {
  chainId: NetworkURN
  display: string
  judgements: string[]
  extra: Record<string, any>
}

/**
 * Account category data.
 *
 * @public
 */
export type AccountCategory = {
  chainId: NetworkURN
  categoryCode: number
  subCategoryCode?: number
}

/**
 * Account tags.
 *
 * @public
 */
export type AccountTag = {
  chainId: NetworkURN
  tag: string
}

/**
 * Account metadata.
 *
 * @public
 */
export type SubstrateAccountMetadata = {
  publicKey: HexString
  evm: {
    address: HexString
    chainId: NetworkURN
  }[]
  identities: AccountIdentity[]
  categories: AccountCategory[]
  tags: AccountTag[]
  updatedAt: number
}

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
