import { toHex } from 'polkadot-api/utils'
import { getStablePoolAddress } from './mappers.js'
import { padAccountKey20 } from '@/common/address.js'

describe('mappers', () => {
  describe('getStablePoolAddress', () => {
    it('should return stableswap pool public key and evm address', () => {
      const poolIdHex = '0xb2020000'
      const bytes = Buffer.from(poolIdHex.slice(2), 'hex')
      const poolId = bytes.readUInt32LE(0)
      const [substrateKey, evmAddress] = getStablePoolAddress(poolId)
      expect(substrateKey).toBe('0xe21da918e4176b72ef1930ffaa17edcb03b9b739c2843fb0cf096283a7d9c261')
      expect(evmAddress).toBe('0xe21da918e4176b72ef1930ffaa17edcb03b9b739')
    })
  })
})
