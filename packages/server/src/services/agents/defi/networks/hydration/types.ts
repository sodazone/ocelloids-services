import { AssetMetadata } from '@/services/agents/steward/types.js'
import { HexString } from '@/services/subscriptions/types.js'

export type PoolReserve = {
  reserves: bigint
  decimals: number
}

export type PoolToken = PoolReserve & {
  id: number
  symbol?: string
}

export type OmniPoolToken = PoolToken & {
  hubReserves: bigint
  cap: bigint
  shares: bigint
  protocolShares: bigint
}

export type Peg = [bigint, bigint]

export type PoolBase = {
  address: HexString
  tokens: PoolToken[]
  isLowLiquidity: boolean
}

export type StableSwapPool = PoolBase & {
  type: 'stableswap'
  id: number
  amplification: bigint
  pegs: Peg[]
  fees: number
  isRampPeriod: boolean
}

export type OmniPool = PoolBase & {
  type: 'omnipool'
  tokens: OmniPoolToken[]
}

export type XykPool = PoolBase & {
  type: 'xyk'
}

export type AavePool = PoolBase & {
  type: 'aave'
  borrowed: bigint
  available: bigint
  oraclePrice: bigint
}

export type Pool = StableSwapPool | OmniPool | XykPool | AavePool

export type AssetMetadataFetcher = (assets: string[]) => Promise<AssetMetadata[]>

export type PoolsContext = {
  stableswap: StableSwapPool[]
  omnipool: OmniPool | null
  aave: AavePool[]
  xyk: XykPool[]
}

export type PoolType = keyof PoolsContext

export type PoolsGraph = Map<number, Edge[]>

export type Edge = {
  poolType: PoolType
  pool: string
  token: number
  isLowLiquidity: boolean
}

type StartNode = {
  token: number
}

export type Path = [StartNode, ...Edge[]]
