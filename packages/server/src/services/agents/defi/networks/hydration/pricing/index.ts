import { Path, PoolsContext } from '../types.js'
import { calculateOmnipoolSpotPrice } from './omnimath.js'
import { calculateStableswapSpotPrice } from './stablemath.js'
import { calculateXykSpotPrice } from './xykmath.js'

const USD_PRECISION = 6

export function calculateSpot(poolsCtx: PoolsContext, path: Path) {
  const [startNode, ...edges] = path

  let tokenIn = startNode.token
  let aggregatePrice = 1

  for (const edge of edges) {
    const { token: tokenOut, poolType, pool: poolAddress } = edge
    let stepPrice: number | null = null

    switch (poolType) {
      case 'omnipool': {
        if (poolsCtx.omnipool === null) {
          throw new Error('Omnipool context is null')
        }
        stepPrice = calculateOmnipoolSpotPrice(poolsCtx.omnipool, tokenIn, tokenOut)
        break
      }
      case 'aave': {
        stepPrice = 1
        break
      }
      case 'stableswap': {
        const pool = poolsCtx.stableswap.find((p) => p.address === poolAddress)
        if (!pool) {
          throw new Error(`Stable pool ${poolAddress} not found`)
        }
        stepPrice = calculateStableswapSpotPrice(pool, tokenIn, tokenOut)
        break
      }
      case 'xyk': {
        const pool = poolsCtx.xyk.find((p) => p.address === poolAddress)
        if (!pool) {
          throw new Error(`XYK pool ${poolAddress} not found`)
        }
        stepPrice = calculateXykSpotPrice(pool, tokenIn, tokenOut)
        break
      }
    }

    if (stepPrice === null) {
      return null
    }

    aggregatePrice *= stepPrice

    tokenIn = tokenOut
  }
  return aggregatePrice
}

/**
 * Calculates USD value from BigInt reserves.
 * @param reserves - The BigInt amount
 * @param decimals - The asset's decimals
 * @param price - The asset price as a number
 */
export function bigintToUsd(reserves: bigint, decimals: number, price: number): number {
  const priceScaled = BigInt(Math.floor(price * 10 ** USD_PRECISION))

  const usdScaled = reserves * priceScaled

  const totalScale = decimals + USD_PRECISION

  const s = usdScaled.toString().padStart(totalScale + 1, '0')
  const integerPart = s.slice(0, -totalScale) || '0'
  const fractionalPart = s.slice(-totalScale)

  return parseFloat(`${integerPart}.${fractionalPart}`)
}
