import { DefiLiquidityCategory } from '../types.js'

export function calculateSuppliedUsd(
  category: DefiLiquidityCategory,
  asset: {
    priceUSD?: string | number | null
    balances: {
      reserves: string | null
    }
  },
): number {
  const price = asset.priceUSD ? Number(asset.priceUSD) : 0
  if (price === 0) {
    return 0
  }

  const balanceAmount = asset.balances.reserves ? parseFloat(asset.balances.reserves) : 0
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

export function calculateLiabilitiesUsd(
  category: DefiLiquidityCategory,
  asset: {
    priceUSD?: string | number | null
    balances: {
      total?: string | null
      reserves: string | null
    }
  },
): number {
  if (category !== 'money-market') {
    return 0
  }

  const price = asset.priceUSD ? Number(asset.priceUSD) : 0
  if (price === 0) {
    return 0
  }

  const balanceAmount = asset.balances.total
    ? parseFloat(asset.balances.total)
    : asset.balances.reserves
      ? parseFloat(asset.balances.reserves)
      : 0
  return balanceAmount * price
}
