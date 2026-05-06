import { PoolReserve } from '../types.js'

export const PRECISION_NUM = 10 ** 18
export const PRECISION_BIGINT = 10n ** 18n
export const TARGET_PRECISION = 18
export const PERMILL_BIGINT = 1_000_000n

export function normalizeValue(
  amount: bigint,
  decimals: number,
  targetDecimals: number,
  roundUp: boolean = false,
): bigint {
  if (decimals === targetDecimals) {
    return amount
  }

  const diff = Math.abs(targetDecimals - decimals)
  const factor = 10n ** BigInt(diff)

  if (targetDecimals > decimals) {
    return amount * factor
  } else {
    const div = amount / factor
    return roundUp ? div + 1n : div
  }
}

export function normalizeReserves(reserves: PoolReserve[]): bigint[] {
  return reserves.map((r) => normalizeValue(r.reserves, r.decimals, TARGET_PRECISION))
}

export function absDiff(a: bigint, b: bigint): bigint {
  return a > b ? a - b : b - a
}

export function formatFixed(value: bigint, decimals: number): string {
  const s = value.toString().padStart(decimals + 1, '0')
  const pos = s.length - decimals
  return s.slice(0, pos) + '.' + s.slice(pos)
}
