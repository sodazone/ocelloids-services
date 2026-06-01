const USD_PRECISION = 6

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

export function bigintToNumber(value: bigint, decimals: number): number {
  const s = value.toString().padStart(decimals + 1, '0')
  const integerPart = s.slice(0, -decimals) || '0'
  const fractionalPart = s.slice(-decimals)

  return parseFloat(`${integerPart}.${fractionalPart}`)
}

export function toProtocol(poolType: string) {
  return `hydration.${poolType}`
}
