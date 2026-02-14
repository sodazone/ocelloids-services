import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'

export type SubstrateAccountMetadata = {
  publicKey: HexString
  evm: {
    address: HexString
    chainId: NetworkURN
  }[]
  identities: {
    chainId: NetworkURN
    display: string
    judgements: string[]
    extra: Record<string, any>
  }[]
  tags: { chainId: NetworkURN; tag: string }[]
  updatedAt: number
}

export type SubstrateAccountUpdate = Partial<SubstrateAccountMetadata> & {
  publicKey: HexString
}
