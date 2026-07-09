import { toAssetId } from '@/services/agents/common/assets.js'
import { CHAIN_ID, DOT_DECIMALS, USDT_DECIMALS } from './common.js'
import { AssetConversionPoolReserves, PoolTokenPrice } from './types.js'

function toDecimal(amount: bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals
}

export function calculatePoolPrices(
  poolReservesMap: Map<string, AssetConversionPoolReserves>,
): Map<string, PoolTokenPrice> {
  const prices = new Map<string, PoolTokenPrice>()

  const usdtPoolEntry = poolReservesMap
    .values()
    .find((pool) => pool.quoteToken.chainId === CHAIN_ID && pool.quoteToken.id === '1984')

  if (!usdtPoolEntry) {
    return prices
  }
  const usdtPool = usdtPoolEntry

  const dotDecimals = usdtPool.baseToken.decimals ?? DOT_DECIMALS
  const usdtDecimals = usdtPool.quoteToken.decimals ?? USDT_DECIMALS
  const dotReserve = toDecimal(usdtPool.baseToken.reserves, dotDecimals)

  const usdtReserve = toDecimal(usdtPool.quoteToken.reserves, usdtDecimals)

  const dotPrice = usdtReserve / dotReserve

  prices.set(toAssetId(usdtPool.baseToken.chainId, usdtPool.baseToken.id), {
    price: dotPrice,
    decimals: dotDecimals,
    symbol: usdtPool.baseToken.symbol,
  })
  prices.set(toAssetId(usdtPool.quoteToken.chainId, usdtPool.quoteToken.id), {
    price: 1,
    decimals: usdtDecimals,
    symbol: usdtPool.quoteToken.symbol,
  })

  for (const pool of poolReservesMap.values()) {
    const { baseToken, quoteToken } = pool

    if (!quoteToken.decimals) {
      continue
    }

    const base = toDecimal(baseToken.reserves, baseToken.decimals ?? DOT_DECIMALS)

    const quote = toDecimal(quoteToken.reserves, quoteToken.decimals)

    const tokenPrice = (base / quote) * dotPrice

    prices.set(toAssetId(quoteToken.chainId, quoteToken.id), {
      price: tokenPrice,
      decimals: quoteToken.decimals,
      symbol: quoteToken.symbol,
    })
  }

  return prices
}
