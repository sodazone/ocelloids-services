import { AssetMetadata } from '@/services/agents/steward/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { MoneyMarketPayload } from '../../types.js'

export interface PoolReserve {
  reserves: bigint
  decimals: number
}

export interface PoolToken extends PoolReserve {
  id: number
  symbol?: string
}

export interface OmniPoolToken extends PoolToken {
  hubReserves: bigint
  cap: bigint
  shares: bigint
  protocolShares: bigint
}

export interface UnderlyingToken extends PoolToken {
  isUnderlying: true;
  available: bigint;
  borrowed: bigint;
}

export interface AToken extends PoolToken {
  isUnderlying: false;
}

export type AaveToken = UnderlyingToken | AToken

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
  oraclePrice: bigint
  details: MoneyMarketPayload
  tokens: AaveToken[]
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
