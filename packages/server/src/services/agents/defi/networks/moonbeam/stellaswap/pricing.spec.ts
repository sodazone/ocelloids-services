import { computeUSDPrices } from './pricing.js'

const edges = [
  {
    from: 'WGLMR',
    to: 'xcDOT',
    price: 0.013667706021042867,
  },
  {
    from: 'WGLMR',
    to: 'xcUSDC',
    price: 0.016781880233781837,
  },
  {
    from: 'xcDOT',
    to: 'xcUSDT',
    price: 1.2241420155007812,
  },
  {
    from: 'xcUSDC',
    to: 'xcUSDT',
    price: 0.9997928018525626,
  },
  {
    from: 'axlUSDC',
    to: 'xcUSDC',
    price: 0.9986069498372114,
  },
]

describe('internal usd spot price', () => {
  it('should compute prices from multiple hops', () => {
    const prices = computeUSDPrices(edges)
    expect(prices['xcDOT']).toBeCloseTo(1.225, 2)
    expect(prices['WGLMR']).toBeCloseTo(0.01665, 3)
    expect(prices['axlUSDC']).toBeCloseTo(1, 1)
    expect(prices['xcUSDT']).toBeCloseTo(1, 1)
  })

  it('should handle completely disconnected tokens', () => {
    const edges = [{ from: 'A', to: 'B', price: 2.0 }]
    const prices = computeUSDPrices(edges, 'xcUSDC')

    expect(prices['A']).toBe(undefined)
    expect(prices['xcUSDC']).toBe(1)
  })

  it('should be resilient to zero or negative prices', () => {
    const edges = [
      { from: 'DOT', to: 'xcUSDC', price: 7.0 },
      { from: 'DOT', to: 'xcUSDC', price: 0 },
      { from: 'DOT', to: 'xcUSDC', price: -5.0 },
    ]
    const prices = computeUSDPrices(edges, 'xcUSDC')

    expect(prices['DOT']).toBe(7.0)
  })

  it('should maintain stablecoin peg strictly', () => {
    const edges = [{ from: 'xcUSDC', to: 'xcUSDT', price: 1.05 }]
    const prices = computeUSDPrices(edges, 'xcUSDT')

    expect(prices['xcUSDC']).toBe(1.05)
    expect(prices['xcUSDT']).toBe(1)
  })

  it('should handle massive price differences (Scalability)', () => {
    const edges = [
      { from: 'SHIB', to: 'USDC', price: 0.000025 },
      { from: 'WBTC', to: 'USDC', price: 65000.0 },
    ]
    const prices = computeUSDPrices(edges, 'USDC')

    expect(prices['SHIB']).toBeCloseTo(0.000025, 6)
    expect(prices['WBTC']).toBeCloseTo(65000, 0)
  })
})
