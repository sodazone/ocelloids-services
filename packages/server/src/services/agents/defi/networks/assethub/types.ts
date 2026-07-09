import { Enum } from 'polkadot-api'
import { XcmLocation } from '@/services/networking/substrate/types.js'
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

// duplicate with Ticker types
export type AssetIdentifier = { chainId: NetworkURN; id: string }

export type BaseAssetMetadata = AssetIdentifier & {
  type: 'local' | 'foreign'
  location: XcmLocation
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

export type TokenReserves = BaseAssetMetadata & {
  reserves: bigint
}

export type AssetConversionPoolReserves = {
  chainId: NetworkURN
  poolTokenId: number
  owner: string
  baseToken: TokenReserves
  quoteToken: TokenReserves
}

export type PoolTokenPrice = { price: number; decimals: number; symbol?: string }
