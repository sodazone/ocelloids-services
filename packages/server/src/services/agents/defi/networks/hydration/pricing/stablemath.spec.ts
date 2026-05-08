import { StableSwapPool } from '../types.js'
import { calculateStableswapSpotPrice } from './stablemath.js'

const stablesReserves100: StableSwapPool = {
  type: 'stableswap',
  address: '0x22bb00df7706a5965728b60f96406ee59ce675fd5fd10652a4ed6f618856ccfe',
  id: 100,
  tokens: [
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
  totalIssuance: 489739599801193155715n,
  amplification: 320n,
  pegs: [
    [1n, 1n],
    [1n, 1n],
    [1n, 1n],
    [1n, 1n],
  ],
  fees: 200,
  isRampPeriod: false,
  sharesDecimals: 18,
  sharesSymbol: '4-Pool',
}

const stableReserves110: StableSwapPool = {
  type: 'stableswap',
  address: '0x0cfd4ae3c8db0e5d06a84cd788c72cb15f8d0c247117b1cc75f69907002674c6',
  id: 110,
  tokens: [
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
  totalIssuance: 2555793334991885908989428n,
  amplification: 222n,
  pegs: [
    [1n, 1n],
    [1n, 1n],
  ],
  fees: 200,
  isRampPeriod: false,
  sharesDecimals: 18,
  sharesSymbol: '2-Pool-HUSDC',
}

describe('stablemath calculations', () => {
  describe('calculateStableswapSpotPrice', () => {
    it('should calculate spot price between 2 stables in deep pool', () => {
      const { tokens } = stableReserves110
      const tokenIn = tokens[0]
      const tokenOut = tokens[1]
      const out = calculateStableswapSpotPrice(
        stableReserves110,
        tokenIn.id,
        tokenOut.id,
        100n * BigInt(10 ** tokenIn.decimals),
      )
      expect(out).toBeCloseTo(0.999, 1)
    })

    it('should calculate spot price from share token to stable in deep pool', () => {
      const { id, tokens } = stableReserves110
      const tokenOut = tokens[1]

      const out = calculateStableswapSpotPrice(
        stableReserves110,
        id,
        tokenOut.id,
        100n * BigInt(10 ** tokenOut.decimals),
      )
      expect(out).toBeCloseTo(0.999, 1)
    })

    it('should calculate spot price from stable to share token in deep pool', () => {
      const { id, tokens } = stableReserves110
      const tokenIn = tokens[0]

      const out = calculateStableswapSpotPrice(
        stableReserves110,
        tokenIn.id,
        id,
        100n * BigInt(10 ** tokenIn.decimals),
      )
      expect(out).toBeCloseTo(0.999, 1)
    })

    it('should calculate spot price between 2 stables in shallow pool', () => {
      const { tokens } = stablesReserves100
      const tokenIn = tokens[0]
      const tokenOut = tokens[1]
      const out = calculateStableswapSpotPrice(
        stablesReserves100,
        tokenIn.id,
        tokenOut.id,
        100n * BigInt(10 ** tokenIn.decimals),
      )
      expect(out).toBeCloseTo(0.999, 1)
    })

    it('should calculate spot price from share token to stable in shallow pool', () => {
      const { id, tokens } = stablesReserves100
      const tokenOut = tokens[0]

      const out = calculateStableswapSpotPrice(
        stablesReserves100,
        id,
        tokenOut.id,
        10n * BigInt(10 ** tokenOut.decimals),
      )
      expect(out).toBeCloseTo(0.999, 1)
    })

    it('should calculate spot price from stable to share token in shallow pool', () => {
      const { id, tokens } = stablesReserves100
      const tokenIn = tokens[0]

      const out = calculateStableswapSpotPrice(
        stablesReserves100,
        tokenIn.id,
        id,
        10n * BigInt(10 ** tokenIn.decimals),
      )
      expect(out).toBeCloseTo(0.999, 1)
    })
  })
})
