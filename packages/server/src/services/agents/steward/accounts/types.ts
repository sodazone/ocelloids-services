import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'

export type AccountIdentity = {
  chainId: NetworkURN
  display: string
  judgements: string[]
  extra: Record<string, any>
}

export type AccountCategory = {
  chainId: NetworkURN
  categoryCode: number
  subCategoryCode?: number
}

export type AccountTag = {
  chainId: NetworkURN
  tag: string
}

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
}

export type SubstrateAccountResult = SubstrateAccountMetadata & {
  accountId: string
}
