import { getStablePoolAddress } from './mappers.js'

describe('mappers', () => {
  describe('getStablePoolAddress', () => {
    it('should return stableswap pool public key and evm address', () => {
      const [substrateKey, evmAddress] = getStablePoolAddress(690)
      expect(substrateKey).toBe('0xe21da918e4176b72ef1930ffaa17edcb03b9b739c2843fb0cf096283a7d9c261')
      expect(evmAddress).toBe('0xe21da918e4176b72ef1930ffaa17edcb03b9b739')
    })
  })
})
