export function calculateAssetTvlUsd(
  category: 'exchange' | 'money-market' | string,
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
    // Lending protocols: TVL is the idle underlying cash liquidity sitting in the contract
    const rawBalance = asset.balances.available ?? asset.balances.reserves
    balanceAmount = rawBalance ? parseFloat(rawBalance) : 0
  } else {
    // AMM/DEX pools: TVL is the total raw liquidity pool reserves stored
    balanceAmount = asset.balances.reserves ? parseFloat(asset.balances.reserves) : 0
  }

  return balanceAmount * price
}
