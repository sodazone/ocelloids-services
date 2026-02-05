import { isSystemAccount } from './convert.js'

describe('convert', () => {
  describe('isSystemAccount', () => {
    it('should return true for system accounts', () => {
      const result1 = isSystemAccount('0x6d6f646c6f6d6e69706f6f6c0000000000000000000000000000000000000000')
      const result2 = isSystemAccount('0x6d6f646c726566657272616c0000000000000000000000000000000000000000')
      expect(result1).toBeTruthy()
      expect(result2).toBeTruthy()
    })
  })
})
