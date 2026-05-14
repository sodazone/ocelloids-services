import { XykPool } from '../types.js'
import { PRECISION_BIGINT, toPrecisionNumber } from './common.js'

/**
 * Calculates XYK spot price using feePermill.
 * Matches Rust: spot_price * (1 - fee_permill / 1,000,000)
 *
 * @param inToken - Reserve of the asset being sold
 * @param outToken - Reserve of the asset being bought
 * @param feePermill - Fee in parts per million (e.g., 3000 for 0.3%)
 */
export function calculateXykSpotPrice(pool: XykPool, assetIn: number, assetOut: number): number | null {
  const inToken = pool.tokens.find((t) => t.id === assetIn)
  const outToken = pool.tokens.find((t) => t.id === assetOut)
  if (!inToken || inToken.reserves === 0n || !outToken) {
    return null
  }

  const priceScaled = (outToken.reserves * PRECISION_BIGINT) / inToken.reserves

  return toPrecisionNumber({
    amountScaled: priceScaled,
    decimalsIn: inToken.decimals,
    decimalsOut: outToken.decimals,
    scale: PRECISION_BIGINT,
  })
}
