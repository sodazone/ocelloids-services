import { wormholeAmountToReal } from './decimals.js'

describe('wormhole amounts with normalized decimals', () => {
  const cases = [
    {
      name: 'equal decimals (token 8, bridge 8)',
      input: { amount: '100000000', tokenDecimals: 8, normalizedDecimals: 8 },
      expected: '100000000',
    },
    {
      name: 'token more precise (token 18, bridge 8)',
      input: { amount: '100000000', tokenDecimals: 18, normalizedDecimals: 8 },
      expected: (BigInt(100000000) * 10n ** 10n).toString(),
    },
    {
      name: 'bridge more precise (token 6, bridge 8)',
      input: { amount: '100000000', tokenDecimals: 6, normalizedDecimals: 8 },
      expected: (BigInt(100000000) / 10n ** 2n).toString(),
    },
    {
      name: 'null normalizedDecimals defaults to 8',
      input: { amount: '12345678', tokenDecimals: 6, normalizedDecimals: null },
      expected: (BigInt(12345678) / 10n ** 2n).toString(),
    },
    {
      name: 'large amount scaling up (18 vs 8)',
      input: { amount: '999999999999999999', tokenDecimals: 18, normalizedDecimals: 8 },
      expected: (BigInt('999999999999999999') * 10n ** 10n).toString(),
    },
    {
      name: 'small amount scaling down (6 vs 12)',
      input: { amount: '1000000000', tokenDecimals: 6, normalizedDecimals: 12 },
      expected: (BigInt('1000000000') / 10n ** 6n).toString(),
    },
  ]

  test.each(cases)('$name', ({ input, expected }) => {
    const { amount, tokenDecimals, normalizedDecimals } = input
    const result = wormholeAmountToReal(amount, tokenDecimals, normalizedDecimals)
    expect(result).toBe(expected)
  })

  it('should transform tokenAmounts back to amounts with precision', () => {
    const tokenAmount = '12'
    const decimals = 18
    const [whole, dec] = tokenAmount.split('.')
    const decLength = dec ? dec.length : 0

    const realAmount = wormholeAmountToReal([whole, dec].join(''), decimals, decLength)
    expect(realAmount).toBe('12000000000000000000')
  })

  it('should transform tokenAmounts with decimals back to amounts with precision', () => {
    const tokenAmount = '67000.12345'
    const decimals = 18
    const [whole, dec] = tokenAmount.split('.')
    const decLength = dec ? dec.length : 0

    const realAmount = wormholeAmountToReal([whole, dec].join(''), decimals, decLength)
    expect(realAmount).toBe('67000123450000000000000')
  })
})
