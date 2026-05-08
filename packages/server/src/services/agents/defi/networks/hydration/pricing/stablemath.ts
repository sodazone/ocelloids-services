import { Peg, PoolReserve, StableSwapPool } from '../types.js'
import { normalizeReserves, PERMILL_BIGINT, PRECISION_BIGINT, PRECISION_NUM } from './common.js'

function calculateAnn(n: number, amplification: bigint): bigint | null {
  return amplification * BigInt(n)
}

export function calculateD(
  reserves: PoolReserve[],
  amplification: bigint,
  pegs: [bigint, bigint][],
  maxIter = 64,
): bigint | null {
  if (reserves.length <= 1 || pegs.length !== reserves.length) {
    return null
  }

  let xp = normalizeReserves(reserves)
  // Apply pegs
  xp = xp.map((x, i) => (x * pegs[i][0]) / pegs[i][1])

  // Mixed zero balance check
  const xp_hp = xp.filter((x) => x > 0n)
  if (xp_hp.length !== xp.length && xp_hp.length > 0) {
    return null
  }
  if (xp_hp.length === 0) {
    return 0n
  }

  // Sorting
  xp_hp.sort((a, b) => (a < b ? -1 : 1))

  const n = BigInt(xp_hp.length)
  const ann = calculateAnn(xp_hp.length, amplification)
  if (!ann) {
    return null
  }

  const sum = xp_hp.reduce((a, b) => a + b, 0n)
  let D = sum

  for (let i = 0; i < maxIter; i++) {
    let D_P = D
    for (const x of xp_hp) {
      D_P = (D_P * D) / (x * n)
    }

    const prevD = D

    const numerator = (ann * sum + D_P * n) * D
    const denominator = (ann - 1n) * D + (n + 1n) * D_P

    D = numerator / denominator + 2n

    const diff = D > prevD ? D - prevD : prevD - D
    if (diff <= 1n) {
      return D
    }
  }

  return D
}

export function calculateSpotPriceStable(
  reserves: PoolReserve[],
  amplification: bigint,
  D: bigint,
  assetInIndex: number,
  assetOutIndex: number,
  feePermill: number | null, // e.g., 3 for 0.3%
  pegs: Peg[],
): number | null {
  const nCoins = reserves.length
  if (nCoins <= 1 || assetInIndex >= nCoins || assetOutIndex >= nCoins) {
    return null
  }

  const ann = calculateAnn(nCoins, amplification)
  if (!ann) {
    return null
  }

  // Adjusted Reserves (Apply Pegs with Downward Rounding)
  const adjustedReserves = reserves.map((r, idx) => {
    const [pNum, pDenom] = pegs[idx]
    return {
      reserves: (r.reserves * pNum) / pDenom,
      decimals: r.decimals,
    }
  })

  // Normalize (Handle decimals to common precision, usually 18)
  const xp = normalizeReserves(adjustedReserves)
  const x0 = xp[assetInIndex]
  const xi = xp[assetOutIndex]

  // Calculate 'c' using High Precision
  // We sort a copy to avoid mutating the original indices needed for x0 and xi
  const sortedXp = [...xp].sort((a, b) => (a < b ? -1 : 1))
  const n = BigInt(nCoins)

  let c = D
  for (const x of sortedXp) {
    c = (c * D) / (x * n)
  }

  // Invariant Derivative (The Spot Price Ratio)
  // Price = x0 * (ann * xi + c) / xi * (ann * x0 + c)
  const num = x0 * (ann * xi + c)
  const denom = xi * (ann * x0 + c)

  // Apply Peg Correction to the Ratio
  // result = (num / denom) * (pegOut / pegIn)
  const [pegInNum, pegInDenom] = pegs[assetInIndex]
  const [pegOutNum, pegOutDenom] = pegs[assetOutIndex]

  // (num * pegOutNum * pegInDenom) / (denom * pegOutDenom * pegInNum)
  const finalNum = num * pegOutNum * pegInDenom
  let finalDenom = denom * pegOutDenom * pegInNum

  if (feePermill !== null) {
    const feeMultiplier = PERMILL_BIGINT - BigInt(feePermill)
    finalDenom = (finalDenom * feeMultiplier) / PERMILL_BIGINT
  }

  const priceScaled = (finalNum * PRECISION_BIGINT) / finalDenom
  return Number(priceScaled) / PRECISION_NUM
}

/**
 * Calculates the amount of shares to be given to an LP providing
 * liquidity in a single asset.
 */
export function calculateSharesForAmount(
  initialReserves: PoolReserve[],
  assetIndex: number,
  amount: bigint,
  amplification: bigint,
  shareIssuance: bigint,
  feePermill: number, // e.g., 3000 for 0.3%
  pegs: [bigint, bigint][],
): { shares: bigint; fees: bigint[] } | null {
  const nCoins = initialReserves.length
  if (nCoins <= 1 || assetIndex >= nCoins || pegs.length !== nCoins) {
    return null
  }

  // Calculate the scaled fee
  // fee = (fee_permill / 1,000,000) * n / (4 * (n - 1))
  const nBI = BigInt(nCoins)

  // We keep the fee as a fraction (numerator/denominator) to maintain precision
  const feeNum = BigInt(feePermill) * nBI
  const feeDenom = PERMILL_BIGINT * 4n * (nBI - 1n)

  // updatedReserves (Pool state AFTER the deposit, logically)
  const updatedReserves = initialReserves.map((v, idx) => ({
    ...v,
    reserves: idx === assetIndex ? v.reserves - amount : v.reserves,
  }))

  // Calculate Invariants
  // D0 = Invariant with full initial reserves
  // D1 = Invariant with updated reserves (initial - deposit)
  const d0 = calculateD(initialReserves, amplification, pegs)
  const d1 = calculateD(updatedReserves, amplification, pegs)
  if (d0 === null || d1 === null) {
    return null
  }

  const fees: bigint[] = []

  // Calculate Adjusted Reserves (Taxing the imbalance)
  const adjustedReserves = updatedReserves.map((assetReserve, idx) => {
    const initialReserve = initialReserves[idx].reserves
    const updatedReserve = assetReserve.reserves
    const idealBalance = (d1 * initialReserve) / d0
    const diff = updatedReserve > idealBalance ? updatedReserve - idealBalance : idealBalance - updatedReserve
    const feeAmount = (diff * feeNum) / feeDenom
    fees.push(feeAmount)

    return {
      ...assetReserve,
      reserves: assetReserve.reserves - feeAmount,
    }
  })

  // Calculate Adjusted D and final Share Issuance
  const adjustedD = calculateD(adjustedReserves, amplification, pegs)
  if (adjustedD === null) {
    return null
  }

  const dDiff = d0 - adjustedD
  const shareAmount = (shareIssuance * dDiff) / d0 + 1n

  return {
    shares: shareAmount,
    fees: fees,
  }
}

/**
 * Calculates shares for a given update in reserves.
 * Mirrors the Rust logic: (issuance * (D_initial - D_adjusted)) / D_initial
 */
export function calculateShares(
  initialReserves: PoolReserve[],
  updatedReserves: PoolReserve[],
  amplification: bigint,
  shareIssuance: bigint,
  feePermill: number,
  pegs: [bigint, bigint][],
): { shares: bigint; fees: bigint[] } | null {
  const nCoins = initialReserves.length
  if (nCoins <= 1 || updatedReserves.length !== nCoins || pegs.length !== nCoins) {
    return null
  }

  // Calculate Initial and Updated Invariants
  const d0 = calculateD(initialReserves, amplification, pegs)
  const d1 = calculateD(updatedReserves, amplification, pegs)
  if (d0 === null || d1 === null) {
    return null
  }

  const nBI = BigInt(nCoins)
  const feeNum = BigInt(feePermill) * nBI
  const feeDenom = PERMILL_BIGINT * 4n * (nBI - 1n)

  const fees: bigint[] = []

  // Calculate Adjusted Reserves (Applying the Imbalance Tax)
  const adjustedReserves: PoolReserve[] = updatedReserves.map((assetReserve, idx) => {
    const initialAmount = initialReserves[idx].reserves
    const updatedAmount = assetReserve.reserves
    const idealBalance = (d1 * initialAmount) / d0
    const diff = updatedAmount > idealBalance ? updatedAmount - idealBalance : idealBalance - updatedAmount
    const feeAmount = (diff * feeNum) / feeDenom
    fees.push(feeAmount)

    return {
      ...assetReserve,
      reserves: updatedAmount - feeAmount,
    }
  })

  // Calculate Final Adjusted Invariant
  const adjustedD = calculateD(adjustedReserves, amplification, pegs)
  if (adjustedD === null) {
    return null
  }

  // Calculate Share Amount
  // share_amount = issuance * (initial_D - adjusted_D) / initial_D + 1
  // We use initial_D (d0) as the denominator
  const dDiff = adjustedD > d0 ? adjustedD - d0 : d0 - adjustedD
  const shareAmount = (shareIssuance * dDiff) / d0 + 1n

  return {
    shares: shareAmount,
    fees: fees,
  }
}

export function calculateStableswapSpotPrice(
  pool: StableSwapPool,
  assetIn: number,
  assetOut: number,
  tradeAmount: bigint,
): number | null {
  const { id: poolId, tokens, amplification, totalIssuance, pegs, sharesDecimals } = pool
  const nCoins = tokens.length

  if (nCoins <= 1 || assetIn === assetOut || pegs.length !== nCoins) {
    return null
  }

  const reserves = tokens.map((r) => ({ reserves: r.reserves, decimals: r.decimals }))

  const D = calculateD(reserves, amplification, pegs)
  if (!D) {
    return null
  }

  const isShareIn = assetIn === poolId
  const isShareOut = assetOut === poolId

  if (!isShareIn && !isShareOut) {
    const i = tokens.findIndex((r) => r.id === assetIn)
    const j = tokens.findIndex((r) => r.id === assetOut)

    return calculateSpotPriceStable(reserves, amplification, D, i, j, null, pegs)
  }
  if (isShareIn && !isShareOut) {
    const i = tokens.findIndex((r) => r.id === assetOut)
    const results = calculateSharesForAmount(reserves, i, tradeAmount, amplification, totalIssuance, 0, pegs)
    if (results === null) {
      return null
    }
    const priceScaled = (results.shares * PRECISION_BIGINT) / tradeAmount

    const decimalAdjustment = 10n ** BigInt(Math.abs(tokens[i].decimals - sharesDecimals))

    let finalPrice
    if (tokens[i].decimals < sharesDecimals) {
      finalPrice = priceScaled / decimalAdjustment
    } else {
      finalPrice = priceScaled * decimalAdjustment
    }

    return Number(finalPrice) / Number(PRECISION_BIGINT)
  }

  if (!isShareIn && isShareOut) {
    const inIdx = tokens.findIndex((r) => r.id === assetIn)
    if (inIdx === -1) {
      return null
    }

    // Create a hypothetical updated reserve state
    const updatedReserves = reserves.map((r, idx) => ({
      ...r,
      reserves: idx === inIdx ? r.reserves + tradeAmount : r.reserves,
    }))

    const result = calculateShares(reserves, updatedReserves, amplification, totalIssuance, 0, pegs)

    if (!result || result.shares === 0n) {
      return null
    }

    const priceScaled = (tradeAmount * PRECISION_BIGINT) / result.shares

    const decimalAdjustment = 10n ** BigInt(Math.abs(sharesDecimals - tokens[inIdx].decimals))

    let finalPrice
    if (sharesDecimals < tokens[inIdx].decimals) {
      finalPrice = priceScaled / decimalAdjustment
    } else {
      finalPrice = priceScaled * decimalAdjustment
    }

    return Number(finalPrice) / Number(PRECISION_BIGINT)
  }

  return null
}
