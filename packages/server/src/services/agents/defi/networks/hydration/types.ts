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
  isUnderlying: true
  available: bigint
  borrowed: bigint
}

export interface AToken extends PoolToken {
  isUnderlying: false
}

export type AaveToken = UnderlyingToken | AToken

export interface HsmMintedToken extends PoolToken {
  mintCap: bigint
  isCollateral: false
}

export interface HsmCollateralToken extends PoolToken {
  maxBuyPriceCoefficient: bigint
  maxInHolding: bigint
  purchaseFee: number
  buyBackFee: number
  buyBackRate: number
  stablePoolId: number
  isCollateral: true
}

export type HsmToken = HsmMintedToken | HsmCollateralToken

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
  oraclePrice: number
  details: MoneyMarketPayload
  tokens: AaveToken[]
}

export type HsmPool = PoolBase & {
  type: 'hsm'
  id: number
  tokens: HsmToken[]
}

export type Pool = StableSwapPool | OmniPool | XykPool | AavePool | HsmPool

export type AssetMetadataFetcher = (assets: string[]) => Promise<AssetMetadata[]>

export type PoolRegistry = {
  stableswap: StableSwapPool[]
  omnipool: OmniPool[]
  aave: AavePool[]
  xyk: XykPool[]
  hsm: HsmPool[]
}

export type PoolType = keyof PoolRegistry

export type PoolByType<K extends PoolType> = PoolRegistry[K][number]

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
