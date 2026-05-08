import { OmniPool, OmniPoolToken } from '../types.js'
import { PRECISION_BIGINT, toPrecisionNumber } from './common.js'

/**
 * Calculates Omnipool Spot Price
 *
 * @param assetA - The 'In' asset
 * @param assetB - The 'Out' asset
 * @param fees - protocol_fee and asset_fee in permill
 */
export function calculateOmnipoolSpotPrice(pool: OmniPool, assetIn: number, assetOut: number): number | null {
  const assetInReserves = pool.tokens.find((t) => t.id === assetIn) as OmniPoolToken | undefined
  const assetOutReserves = pool.tokens.find((t) => t.id === assetOut) as OmniPoolToken | undefined
  if (
    !assetInReserves ||
    assetInReserves.reserves === 0n ||
    !assetOutReserves ||
    assetOutReserves.hubReserves === 0n
  ) {
    return null
  }

  // spot_price_without_fee = (Q_a / R_a) * (R_b / Q_b)
  const num = assetInReserves.hubReserves * assetOutReserves.reserves
  const den = assetInReserves.reserves * assetOutReserves.hubReserves

  const priceScaled = (num * PRECISION_BIGINT) / den

  return toPrecisionNumber({
    priceScaled,
    decimalsIn: assetInReserves.decimals,
    decimalsOut: assetOutReserves.decimals,
    scale: PRECISION_BIGINT,
  })
}
