import { XykPool } from '../types.js'
import { calculateXykSpotPrice } from './xykmath.js'

const UNQ_POOL: XykPool = {
  type: 'xyk',
  address: '0xf4262f94584a25196d90287ca673b753fa68b168fe4f22030db0162fd4acba21',
  tokens: [
    { id: 10, reserves: 645980525n, decimals: 6, symbol: 'USDT' },
    {
      id: 25,
      reserves: 1122825189066601885819662n,
      decimals: 18,
      symbol: 'UNQ',
    },
  ],
}

const MYTH_POOL: XykPool = {
  type: 'xyk',
  address: '0xbf80080b4d0077544ef058a29e878ae6f6bdb8cf2f462ab390490f668eb50b73',
  tokens: [
    { id: 5, reserves: 145465131250660n, decimals: 10, symbol: 'DOT' },
    {
      id: 30,
      reserves: 8752210503590140990226975n,
      decimals: 18,
      symbol: 'MYTH',
    },
  ],
}
describe('xyk calculations', () => {
  describe('calculateXykSpotPrice', () => {
    it('should calculate spot price of UNQ to USDT', () => {
      const usdt = UNQ_POOL.tokens[0]
      const unq = UNQ_POOL.tokens[1]
      const spot = calculateXykSpotPrice(UNQ_POOL, unq.id, usdt.id)

      expect(spot).toBeCloseTo(0.0005697, 4)
    })

    it('should calculate spot price of MYTH to DOT', () => {
      const dot = MYTH_POOL.tokens[0]
      const myth = MYTH_POOL.tokens[1]
      const spot = calculateXykSpotPrice(MYTH_POOL, myth.id, dot.id)

      expect(spot).toBeCloseTo(0.001662, 4)
    })
  })
})
