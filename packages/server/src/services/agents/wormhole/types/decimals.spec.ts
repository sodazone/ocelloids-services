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
})
