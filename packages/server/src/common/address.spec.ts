import { fromHex } from 'polkadot-api/utils'
import { padAccountKey20, publicKeyToSS58, ss58ToPublicKey } from './address.js'

describe('SS58 conversion', () => {
  const alicePublicKey = fromHex('0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d')

  it('encodes public key to SS58 address (prefix 42)', () => {
    const address = publicKeyToSS58(alicePublicKey, 42)

    expect(address).toBe('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY')
  })

  it.only('encodes evm address to SS58 (hydration)', () => {
    const address = publicKeyToSS58(padAccountKey20('0x0deb93e5c2f77c83fcff06ac3042cb81e06f4f1a'))

    expect(address).toBe('12ZuLmUHiTokiUa35br7QLDm2GWGhxXuQqq5UiUBUguKxjbq')
  })

  it('decodes SS58 address to public key', () => {
    const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'

    const decoded = ss58ToPublicKey(address)

    expect(decoded).toEqual(alicePublicKey)
  })

  it('round-trip: publicKey → ss58 → publicKey', () => {
    const address = publicKeyToSS58(alicePublicKey, 42)
    const decoded = ss58ToPublicKey(address)

    expect(decoded).toEqual(alicePublicKey)
  })

  it('supports different 1-byte prefixes', () => {
    const prefixes = [0, 2, 42]

    for (const prefix of prefixes) {
      const address = publicKeyToSS58(alicePublicKey, prefix)
      const decoded = ss58ToPublicKey(address)

      expect(decoded).toEqual(alicePublicKey)
    }
  })

  it('supports 2-byte prefixes (>= 64)', () => {
    const prefix = 128 // 2-byte SS58 prefix

    const address = publicKeyToSS58(alicePublicKey, prefix)
    const decoded = ss58ToPublicKey(address)

    expect(decoded).toEqual(alicePublicKey)
  })

  it('throws if public key length is invalid', () => {
    expect(() => publicKeyToSS58(new Uint8Array(31), 42)).toThrow('Public key must be 32 bytes')
  })

  it('throws on invalid SS58 address', () => {
    expect(() => ss58ToPublicKey('not-an-address')).toThrow()
  })
})
