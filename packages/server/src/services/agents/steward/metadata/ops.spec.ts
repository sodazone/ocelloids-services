import { fromHex, toHex } from 'polkadot-api/utils'
import { hashItemPartialKey } from './ops.js'

describe('steward ops', () => {
  describe('hashItemPartialKey', () => {
    it('should hash Twox64Concat data', () => {
      const data = Buffer.from([9, 8])
      expect(toHex(hashItemPartialKey(data, [{ tag: 'Twox64Concat', value: undefined }]))).toEqual(
        '0xaef9d65dd8dd7c600908',
      )
    })

    it('should hash Twox128 data', () => {
      const data = Buffer.from([9, 8])
      expect(toHex(hashItemPartialKey(data, [{ tag: 'Twox128', value: undefined }]))).toEqual(
        '0xaef9d65dd8dd7c60a2391abfe2e6965b',
      )
    })

    it('should hash Twox256 data', () => {
      const data = Buffer.from([9, 8])
      expect(toHex(hashItemPartialKey(data, [{ tag: 'Twox256', value: undefined }]))).toEqual(
        '0xaef9d65dd8dd7c60a2391abfe2e6965bea1990d7a600d7612e510369cb2eeb6b',
      )
    })

    it('should hash Blake2128Concat data', () => {
      const data = Buffer.from([0, 0, 0, 0])
      expect(toHex(hashItemPartialKey(data, [{ tag: 'Blake2128Concat', value: undefined }]))).toEqual(
        '0x11d2df4e979aa105cf552e9544ebd2b500000000',
      )
    })

    it('should hash Blake2128 data', () => {
      const data = Buffer.from([0, 0, 0, 0])
      expect(toHex(hashItemPartialKey(data, [{ tag: 'Blake2128', value: undefined }]))).toEqual(
        '0x11d2df4e979aa105cf552e9544ebd2b5',
      )
    })

    it('should hash Blake2256 data', () => {
      const data = Buffer.from([0, 0, 0, 0])
      expect(toHex(hashItemPartialKey(data, [{ tag: 'Blake2256', value: undefined }]))).toEqual(
        '0x11da6d1f761ddf9bdb4c9d6e5303ebd41f61858d0a5647a1a7bfe089bf921be9',
      )
    })

    it('should hash Identity data', () => {
      const data = fromHex('0xa611589a9fbce38d27580d6b9577bf5b362ba4161024540c1d187e12a596b95d')
      expect(toHex(hashItemPartialKey(data, [{ tag: 'Identity', value: undefined }]))).toEqual(
        '0xa611589a9fbce38d27580d6b9577bf5b362ba4161024540c1d187e12a596b95d',
      )
    })

    it('show throw if multiple hashers are provided', () => {
      const data = Buffer.from([9, 8])
      expect(() =>
        hashItemPartialKey(data, [
          { tag: 'Twox64Concat', value: undefined },
          { tag: 'Blake2128Concat', value: undefined },
        ]),
      ).toThrowError('Multiple hasher not supported')
    })
  })
})
