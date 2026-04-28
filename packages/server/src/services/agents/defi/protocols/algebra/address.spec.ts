import { computePoolAddress } from './address.js'

describe('algebra pool addresses', () => {
  it('should compute stellaswap V4 pool address by pair', () => {
    const INIT_POOL_HASH = '0xb3fc09be5eb433d99b1ec89fd8435aaf5ffea75c1879e19028aa2414a14b3c85'
    const DEPLOYER = '0x87a4F009f99E2F34A34A260bEa765877477c7EF9'
    const tokens: Record<string, `0x${string}`> = {
      xcDOT: '0xffffffff1fcacbd218edc0eba20fc2308c778080',
      GLMR: '0xacc15dc74880c9944775448304b263d191c6077f',
    }
    expect(computePoolAddress(DEPLOYER, tokens.GLMR, tokens.xcDOT, INIT_POOL_HASH)).toBe(
      '0xc295aa4287127C5776Ad7031648692659eF2ceBB',
    )
  })
})
