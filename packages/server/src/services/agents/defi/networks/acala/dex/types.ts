export type AcalaDexReservesValue = [bigint, bigint]
export type TokenId = { type: string; value: number | string | { type: string; value: any } }

export type AcalaPoolToken = {
  id: string
  symbol?: string
  decimals?: number
  reserve: bigint
}

export type AcalaPool = {
  token0: AcalaPoolToken
  token1: AcalaPoolToken
}
