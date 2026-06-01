import { HexString } from '@/lib.js'

export type PriceEdge = {
  from: string
  to: string
  price: number
}

export type SwapEventArgs = {
  sender: HexString
  recipient: HexString
  amount0: string
  amount1: string
  price: string
  liquidity: string
  tick: number
}

export type MintEventArgs = {
  owner: HexString
  bottomTick: number
  topTick: number
  sender: HexString
  liquidityAmount: string
  amount0: string
  amount1: string
}

export type BurnEventArgs = {
  owner: HexString
  bottomTick: number
  topTick: number
  liquidityAmount: string
  amount0: string
  amount1: string
  pluginFee: number
}
