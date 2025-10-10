export function wormholeAmountToReal(
  amount: string,
  tokenDecimals: number,
  normalizedDecimals: number | string | null,
): string {
  const bridgeDecimals = normalizedDecimals === null ? 8 : Number(normalizedDecimals)
  const value = BigInt(amount)

  if (tokenDecimals >= bridgeDecimals) {
    const scale = 10n ** BigInt(tokenDecimals - bridgeDecimals)
    return (value * scale).toString()
  } else {
    const scale = 10n ** BigInt(bridgeDecimals - tokenDecimals)
    return (value / scale).toString()
  }
}

export function toDecimalAmount(amount: string, decimals: number): number {
  const scale = 10n ** BigInt(decimals)
  const value = BigInt(amount)
  return Number(value) / Number(scale)
}
