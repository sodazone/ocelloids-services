import { AssetMetadata } from '@/services/agents/steward/types.js'
import { HexString } from '@/services/subscriptions/types.js'

export type PoolToken = {
  id: number
  reserves: bigint
  decimals: number
  symbol?: string
}

export type OmniPoolToken = PoolToken & {
  hubReserves: bigint
  cap: bigint
  shares: bigint
  protocolShares: bigint
}

export type StableSwapPool = {
  type: 'stableswap'
  address: HexString
  id: number
  tokens: PoolToken[]
  totalIssuance: bigint
  amplification: bigint
  pegs: string[][]
  fees: number
  isRampPeriod: boolean
}

export type OmniPool = {
  type: 'omnipool'
  address: HexString
  tokens: OmniPoolToken[]
}

export type XykPool = {
  type: 'xyk'
  address: HexString
  tokens: PoolToken[]
}

export type AavePool = {
  type: 'aave'
  address: HexString
  borrowed: bigint
  available: bigint
  oraclePrice: bigint
  tokens: PoolToken[]
}

export type Pool = StableSwapPool | OmniPool | XykPool | AavePool

export type AssetMetadataFetcher = (assets: string[]) => Promise<AssetMetadata[]>
