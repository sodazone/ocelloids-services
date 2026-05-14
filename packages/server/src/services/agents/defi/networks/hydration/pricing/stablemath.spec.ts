import { StableSwapPool } from '../types.js'
import { calculateStableswapSpotPrice } from './stablemath.js'

const stablesReservesGiga: StableSwapPool = {
  type: 'stableswap',
  address: '0x0c34f5f4950f3bf6c57da86062a40e0c55f0b74e5f6a571f11f5de30dd522bab',
  id: 4200,
  tokens: [
    {
      id: 4200,
      reserves: 1790306993592652125730n,
      decimals: 18,
      symbol: '2-Pool-GETH'
    },
    {
      id: 1007,
      reserves: 921613250525163625502n,
      decimals: 18,
      symbol: 'aETH'
    },
    {
      id: 1000809,
      reserves: 721095369326455464965n,
      decimals: 18,
      symbol: 'wstETH'
    }
  ],
  amplification: 100n,
  pegs: [
    [ 1n, 1n ],
    [
      262533542342767814095402944701702117995n,
      213014422497900992085811583939854325997n
    ]
  ],
  fees: 690,
  isRampPeriod: false,
  isLowLiquidity: false
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

    it('should calculate spot price between 2 stables in giga pool', () => {
      const { tokens } = stablesReservesGiga
      const tokenIn = tokens[1]
      const tokenOut = tokens[2]
      const out = calculateStableswapSpotPrice(stablesReservesGiga, tokenIn.id, tokenOut.id)
      expect(out).toBeCloseTo(0.81109, 2)
    })

    it('should calculate spot price from share token to stable in giga pool', () => {
      const { id, tokens } = stablesReservesGiga
      const tokenOut = tokens[1]
      // spot price GETH in > aETH out
      const out = calculateStableswapSpotPrice(stablesReservesGiga, id, tokenOut.id)
      expect(out).toBeCloseTo(1.0111, 2)
    })

    it('should calculate spot price from stable to share token in giga pool', () => {
      const { id, tokens } = stablesReservesGiga
      const tokenIn = tokens[2]
      // spot price wstETH in > GETH out
      const out = calculateStableswapSpotPrice(stablesReservesGiga, tokenIn.id, id)
      expect(out).toBeCloseTo(1.219, 2)
    })
  })
})
