import { StableSwapPool } from '../types.js'
import { calculateStableswapSpotPrice } from './stablemath.js'

const stablesReservesLowLiq: StableSwapPool = {
  type: 'stableswap',
  address: '0xaffeef2e0ccac1986d8ac3b557e1e0d682d649bf61aee81e1a7faaab7eae35e0',
  id: 101,
  tokens: [
    {
      id: 101,
      reserves: 39653834808673304n,
      decimals: 18,
      symbol: '2-Pool',
    },
    { id: 11, reserves: 2309436n, decimals: 8, symbol: 'iBTC' },
    { id: 19, reserves: 1759829n, decimals: 8, symbol: 'WBTC' },
  ],
  amplification: 5n,
  pegs: [
    [1n, 1n],
    [1n, 1n],
  ],
  fees: 200,
  isRampPeriod: false,
  isLowLiquidity: false,
}

const stableReserves110: StableSwapPool = {
  type: 'stableswap',
  address: '0x0cfd4ae3c8db0e5d06a84cd788c72cb15f8d0c247117b1cc75f69907002674c6',
  id: 110,
  tokens: [
    {
      id: 110,
      reserves: 2555793334991885908989428n,
      decimals: 18,
      symbol: '2-Pool-HUSDC',
    },
    {
      id: 222,
      reserves: 1551243534834908108749561n,
      decimals: 18,
      symbol: 'HOLLAR',
    },
    {
      id: 1003,
      reserves: 1033663918861n,
      decimals: 6,
      symbol: 'aUSDC',
    },
  ],
  amplification: 222n,
  pegs: [
    [1n, 1n],
    [1n, 1n],
  ],
  fees: 200,
  isRampPeriod: false,
  isLowLiquidity: false,
}

describe('stablemath calculations', () => {
  describe('calculateStableswapSpotPrice', () => {
    it('should calculate spot price between 2 stables in deep pool', () => {
      const { tokens } = stableReserves110
      const tokenIn = tokens[1]
      const tokenOut = tokens[2]
      const out = calculateStableswapSpotPrice(stableReserves110, tokenIn.id, tokenOut.id)
      expect(out).toBeCloseTo(0.999, 1)
    })

    it('should calculate spot price from share token to stable in deep pool', () => {
      const { id, tokens } = stableReserves110
      const tokenOut = tokens[1]

      const out = calculateStableswapSpotPrice(stableReserves110, id, tokenOut.id)
      expect(out).toBeCloseTo(0.999, 1)
    })

    it('should calculate spot price from stable to share token in deep pool', () => {
      const { id, tokens } = stableReserves110
      const tokenIn = tokens[1]

      const out = calculateStableswapSpotPrice(stableReserves110, tokenIn.id, id)
      expect(out).toBeCloseTo(0.999, 1)
    })

    it.only('should calculate spot price between 2 stables in shallow pool', () => {
      const { tokens } = stablesReservesLowLiq
      const tokenIn = tokens[1]
      const tokenOut = tokens[2]
      const out = calculateStableswapSpotPrice(stablesReservesLowLiq, tokenIn.id, tokenOut.id)
      expect(out).toBeCloseTo(0.999, 1)
    })

    it('should calculate spot price from share token to stable in shallow pool', () => {
      const { id, tokens } = stablesReservesLowLiq
      const tokenOut = tokens[1]

      const out = calculateStableswapSpotPrice(stablesReservesLowLiq, id, tokenOut.id)
      expect(out).toBeCloseTo(0.999, 1)
    })

    it('should calculate spot price from stable to share token in shallow pool', () => {
      const { id, tokens } = stablesReservesLowLiq
      const tokenIn = tokens[1]

      const out = calculateStableswapSpotPrice(stablesReservesLowLiq, tokenIn.id, id)
      expect(out).toBeCloseTo(0.999, 1)
    })
  })
})
