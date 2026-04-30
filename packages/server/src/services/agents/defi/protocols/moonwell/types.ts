import { HexString } from '@/lib.js'

export type Token = { address: HexString; symbol: string; decimals: number; name?: string }
export type Market = {
  mToken: Token
  underlying: Token
}
