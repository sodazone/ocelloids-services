import { Enum } from 'polkadot-api'
import { AssetId } from '@/services/agents/steward/types.js'
import { NetworkURN } from '@/services/types.js'

export type PoolAssetsAssetValue = {
  owner: string
  issuer: string
  admin: string
  freezer: string
  supply: bigint
  deposit: bigint
  min_balance: bigint
  is_sufficient: boolean
  accounts: number
  sufficients: number
  approvals: number
  status: Enum<{
    Live: undefined
    Frozen: undefined
    Destroying: undefined
  }>
}

export type BaseAssetMetadata = {
  chainId: NetworkURN
  id: AssetId
  decimals?: number
  symbol?: string
}

export type AssetConversionPool = {
  chainId: NetworkURN
  poolTokenId: number
  owner: string
  baseToken: BaseAssetMetadata
  quoteToken: BaseAssetMetadata
}
