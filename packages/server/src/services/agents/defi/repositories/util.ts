import { DefiLiquidityCategory } from '../types.js'

export function calculateSuppliedUsd(
  category: DefiLiquidityCategory,
  asset: {
    priceUSD?: string | number | null
    balances: {
      available?: string | null
      reserves: string | null
    }
  },
): number {
  const price = asset.priceUSD ? Number(asset.priceUSD) : 0
  if (price === 0) {
    return 0
  }

  let balanceAmount = 0

  if (category === 'money-market') {
    // Lending protocols: supplied is the idle underlying cash liquidity sitting in the contract
    const rawBalance = asset.balances.available ?? asset.balances.reserves
    balanceAmount = rawBalance ? parseFloat(rawBalance) : 0
  } else {
    // AMM/DEX pools: supplied is the total raw liquidity pool reserves stored
    balanceAmount = asset.balances.reserves ? parseFloat(asset.balances.reserves) : 0
  }

  return balanceAmount * price
}

export function calculateBorrowedUsd(
  category: DefiLiquidityCategory,
  asset: {
    priceUSD?: string | number | null
    balances: { borrowed?: string | null }
  },
): number {
  if (category !== 'money-market') {
    return 0
  }

  const price = asset.priceUSD ? Number(asset.priceUSD) : 0
  if (price === 0) {
    return 0
  }

  const balanceAmount = asset.balances.borrowed ? parseFloat(asset.balances.borrowed) : 0
  return balanceAmount * price
}
