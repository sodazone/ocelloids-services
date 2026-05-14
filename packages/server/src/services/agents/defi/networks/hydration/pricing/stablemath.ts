import { Peg, PoolReserve, StableSwapPool } from '../types.js'
import { normalizeReserves, PERMILL_BIGINT, PRECISION_BIGINT, PRECISION_NUM, toPrecisionNumber } from './common.js'

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
  feePermill: number | null,
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

  // 1. Adjusted Reserves (Apply Pegs)
  const adjustedReserves = reserves.map((r, idx) => {
    const [pNum, pDenom] = pegs[idx]
    return {
      reserves: (r.reserves * pNum) / pDenom,
      decimals: r.decimals,
    }
  })

  // 2. Normalize to common precision
  const xp = normalizeReserves(adjustedReserves)
  const xIn = xp[assetInIndex] // Formerly x0
  const xOut = xp[assetOutIndex] // Formerly xi

  // 3. Calculate 'c' Invariant
  const n = BigInt(nCoins)
  let c = D
  for (const x of xp) {
    c = (c * D) / (x * n)
  }

  /**
   * 4. Invariant Derivative (The Spot Price Ratio)
   * To get "Amount Out per 1 unit of In", the formula is:
   * Price = (xOut * (ann * xIn + c)) / (xIn * (ann * xOut + c))
   */
  const num = xOut * (ann * xIn + c)
  const denom = xIn * (ann * xOut + c)

  // 5. Apply Peg Correction
  // result = (num / denom) * (pegIn / pegOut)
  // We flip the pegs because we flipped the num/denom ratio
  const [pegInNum, pegInDenom] = pegs[assetInIndex]
  const [pegOutNum, pegOutDenom] = pegs[assetOutIndex]

  const finalNum = num * pegInNum * pegOutDenom
  const finalDenom = denom * pegInDenom * pegOutNum

  // 6. Apply Fees (Deduct from the output)
  if (feePermill !== null) {
    const feeMultiplier = PERMILL_BIGINT - BigInt(feePermill)
    // Fee reduces the numerator (the amount out)
    return (
      Number(finalNum * feeMultiplier * PRECISION_BIGINT) /
      Number(finalDenom * PERMILL_BIGINT) /
      PRECISION_NUM
    )
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
): number | null {
  const { id: poolId, tokens, amplification, pegs } = pool

  const stableTokens = tokens
    .filter((r) => r.id !== poolId)

  const nCoins = stableTokens.length

  if (nCoins <= 1 || assetIn === assetOut || pegs.length !== nCoins) {
    return null
  }

  const D = calculateD(stableTokens, amplification, pegs)
  if (!D) {
    return null
  }

  const isShareIn = assetIn === poolId
  const isShareOut = assetOut === poolId
  const sharesToken = tokens.find((r) => r.id === poolId)
  if (!sharesToken) {
    return null
  }
  const { reserves: sharesIssuance, decimals: sharesDecimals } = sharesToken
  if (!isShareIn && !isShareOut) {
    const i = stableTokens.findIndex((r) => r.id === assetIn)
    const j = stableTokens.findIndex((r) => r.id === assetOut)
    if (i === -1 || j === -1) {
      return null
    }
    return calculateSpotPriceStable(stableTokens, amplification, D, i, j, null, pegs)
  }
  if (isShareIn && !isShareOut) {
    const i = stableTokens.findIndex((r) => r.id === assetOut)
    if (i === -1) {
      return null
    }
    // Set trade amount to 0.1% of the token reserves
    const tradeAmount = stableTokens[i].reserves / 1_000n

    const results = calculateSharesForAmount(
      stableTokens,
      i,
      tradeAmount,
      amplification,
      sharesIssuance,
      0,
      pegs,
    )
    if (results === null) {
      return null
    }
    const priceScaled = (tradeAmount * PRECISION_BIGINT) / results.shares

    return toPrecisionNumber({
      priceScaled,
      decimalsIn: sharesDecimals,
      decimalsOut: stableTokens[i].decimals,
      scale: PRECISION_BIGINT
    })
  }

  if (!isShareIn && isShareOut) {
    const i = stableTokens.findIndex((r) => r.id === assetIn)
    if (i === -1) {
      return null
    }
    // Set trade amount to 0.1% of the token reserves
    const tradeAmount = stableTokens[i].reserves / 1_000n

    // Create a hypothetical updated reserve state
    const updatedReserves = stableTokens.map((r, idx) => ({
      ...r,
      reserves: idx === i ? r.reserves + tradeAmount : r.reserves,
    }))

    const result = calculateShares(stableTokens, updatedReserves, amplification, sharesIssuance, 0, pegs)

    if (!result || result.shares === 0n) {
      return null
    }

    const priceScaled = (result.shares * PRECISION_BIGINT) / tradeAmount
    return toPrecisionNumber({
      priceScaled,
      decimalsIn: stableTokens[i].decimals,
      decimalsOut: sharesDecimals,
      scale: PRECISION_BIGINT
    })
  }

  return null
}
