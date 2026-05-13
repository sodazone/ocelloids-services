import { StableSwapPool } from '../types.js'
import { calculateStableswapSpotPrice } from './stablemath.js'

const stablesReservesLowLiq: StableSwapPool = {
  type: 'stableswap',
  address: '0x22bb00df7706a5965728b60f96406ee59ce675fd5fd10652a4ed6f618856ccfe',
  id: 100,
  tokens: [
    { id: 100, reserves: 489739599801193155715n, decimals: 18, symbol: '4-Pool' },
    { id: 10, reserves: 53840243n, decimals: 6, symbol: 'USDT' },
    {
      id: 18,
      reserves: 354157031119211120050n,
      decimals: 18,
      symbol: 'DAI',
    },
    { id: 21, reserves: 53847086n, decimals: 6, symbol: 'USDC' },
    { id: 23, reserves: 53644878n, decimals: 6, symbol: 'USDT' },
  ],
  amplification: 320n,
  pegs: [
    [1n, 1n],
    [1n, 1n],
    [1n, 1n],
    [1n, 1n],
  ],
  fees: 200,
  isRampPeriod: false,
  isLowLiquidity: true,
}

const stableReservesDeepLiq: StableSwapPool = {
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
      const { tokens } = stableReservesDeepLiq
      const tokenIn = tokens[1]
      const tokenOut = tokens[2]
      const out = calculateStableswapSpotPrice(stableReservesDeepLiq, tokenIn.id, tokenOut.id)
      expect(out).toBeCloseTo(0.999, 1)
    })

    it('should calculate spot price from share token to stable in deep pool', () => {
      const { id, tokens } = stableReservesDeepLiq
      const tokenOut = tokens[1]

      const out = calculateStableswapSpotPrice(stableReservesDeepLiq, id, tokenOut.id)
      expect(out).toBeCloseTo(0.999, 1)
    })

    it('should calculate spot price from stable to share token in deep pool', () => {
      const { id, tokens } = stableReservesDeepLiq
      const tokenIn = tokens[1]

      const out = calculateStableswapSpotPrice(stableReservesDeepLiq, tokenIn.id, id)
      expect(out).toBeCloseTo(0.999, 1)
    })

    it('should calculate spot price between 2 stables in shallow pool', () => {
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
