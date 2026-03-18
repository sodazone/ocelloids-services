import { fromHex } from 'polkadot-api/utils'
import { decodeGmpInstruction } from './gmp.js'

describe('decodeGmpInstruction', () => {
  it('should decode EVM beneficiary', () => {
    const payload = fromHex(
      '0x0005010200c91f0100455448000deb93e5c2f77c83fcff06ac3042cb81e06f4f1a0000000000000000',
    )
    const decoded = decodeGmpInstruction(payload)
    expect(decoded).toBeDefined()
    expect(decoded?.gmp.resolved).toBeDefined()
    expect(decoded?.gmp.resolved?.address?.key).toBe('0x0deb93e5c2f77c83fcff06ac3042cb81e06f4f1a')
    expect(decoded?.gmp.resolved?.address?.formatted).toBe('0x0deb93e5c2f77c83fcff06ac3042cb81e06f4f1a')
  })

  it('should decode Substrate beneficiary', () => {
    const payload = fromHex(
      '0x0005010200c91f010074a9accd4e9b0d530c7047e0ede0a6b1d1d8ba5ccc8827c47f09ffa7fe95c33c',
    )
    const decoded = decodeGmpInstruction(payload)
    expect(decoded).toBeDefined()
    expect(decoded?.gmp.resolved).toBeDefined()
    expect(decoded?.gmp.resolved?.address?.key).toBe(
      '0x74a9accd4e9b0d530c7047e0ede0a6b1d1d8ba5ccc8827c47f09ffa7fe95c33c',
    )
    expect(decoded?.gmp.resolved?.address?.formatted).toBe('13dxxbqUHL7YJPyFnyo9pPuACoiZZtifHMUr1sSZ6RkXcbRU')
  })
})
