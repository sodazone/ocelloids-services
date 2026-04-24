export type PoolToken = {
  id: string
  reserves: bigint
}

export type StablesPool = {
  type: 'stableswap'
  address: string
  id: string
  tokens: PoolToken[]
  reserves: string
  totalIssuance: string
  amplification: string
  pegs: string
  fees: number
}

export type OmniPool = {
  type: 'omnipool'
  address: string
  assetFee: number
  protocolFee: number
  tokens: PoolToken[]
}

export type XykPool = {
  type: 'xyk'
  address: string
  tokens: PoolToken[]
}

export type AavePool = {
  type: 'aave'
  address: string
  tokens: PoolToken[]
}

export type Pool = StablesPool | OmniPool | XykPool | AavePool
