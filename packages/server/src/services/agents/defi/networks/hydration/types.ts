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

export type StableSwapPool = {
  type: 'stableswap'
  address: HexString
  id: number
  tokens: PoolToken[]
  totalIssuance: bigint
  amplification: bigint
  pegs: Peg[]
  fees: number
  isRampPeriod: boolean
  sharesDecimals: number
  sharesSymbol?: string
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
}

type StartNode = {
  token: number
}

export type Path = [StartNode, ...Edge[]]
