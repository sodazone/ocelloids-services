import { AnyJson } from '@/lib.js'
import { asPublicKey, asSerializable, fromDuckDBBlob, toDuckDBHex } from './util.js'

describe('utility functions', () => {
  it('should transform SS58 addresses', () => {
    expect(asPublicKey('dfZvF6iz8qvsdGEWTHBoo2daJWq386QYfDXwfsycTJhicxLcc')).toBe(
      '0x94e58ead97ea7dbbc1f671d23a8d52a66e5659da2eddc1d139e0c49d8f648441',
    )
  })
  it('should bypass hex strings', () => {
    expect(asPublicKey('0x94e58ead97ea7dbbc1f671d23a8d52a66e5659da2eddc1d139e0c49d8f648441')).toBe(
      '0x94e58ead97ea7dbbc1f671d23a8d52a66e5659da2eddc1d139e0c49d8f648441',
    )
  })
  it('should serialize objecs', () => {
    expect(asSerializable({ one: 1 })).toStrictEqual({ one: 1 })
  })
  it('should serialize strings', () => {
    expect(asSerializable('lol')).toBe('lol')
  })
  it('should serialize objecs with bigints', () => {
    expect(asSerializable({ one: 1n })).toStrictEqual({ one: '1' })
  })
  it('should serialize objecs with dangerous casting', () => {
    type a = {
      b: number
    }
    const x = (p: a) => p.b
    expect(x(asSerializable<a>({ b: 2 }))).toBe(2)
  })

  it('should serialize objecs to AnyJson', () => {
    expect(asSerializable<AnyJson>({ a: 'abc', b: 100n, c: 10 })).toStrictEqual({
      a: 'abc',
      b: '100',
      c: 10,
    })
  })

  it('should decode from test vectors', () => {
    const vectors = [
      ['x0075726E3A6F636E3A706F6C6B61646F743A323030347C6E6174697665', 'urn:ocn:polkadot:2004|native'],
      ['x0075726E3A6F636E3A706F6C6B61646F743A307C6E6174697665', 'urn:ocn:polkadot:0|native'],
      ['x0075726E3A6F636E3A706F6C6B61646F743A313030307C31333337', 'urn:ocn:polkadot:1000|1337'],
      ['x0075726E3A6F636E3A706F6C6B61646F743A31303030', 'urn:ocn:polkadot:1000'],
      [
        'x01B653A2174CF0BF2719AA2B85C0BA0C912A302CD99FAAB5C3CD129779945FDB55',
        '0xB653A2174CF0BF2719AA2B85C0BA0C912A302CD99FAAB5C3CD129779945FDB55',
      ],
    ]

    for (const v of vectors) {
      expect(fromDuckDBBlob({ toString: () => v[0], bytes: new Uint8Array([0x78]) })).toBe(v[1])
    }
  })

  it('should encode and decode hex strings', () => {
    expect(toDuckDBHex('0x601D579ECD0464A1A090CEEF81A703465A1679CD')).toBe(
      "X'01601D579ECD0464A1A090CEEF81A703465A1679CD'",
    )
    expect(
      fromDuckDBBlob({
        toString: () => 'x01601D579ECD0464A1A090CEEF81A703465A1679CD',
        bytes: new Uint8Array([0x78]),
      }),
    ).toBe('0x601D579ECD0464A1A090CEEF81A703465A1679CD')
  })

  it('should encode and decode raw strings', () => {
    expect(toDuckDBHex('hello:hello|0')).toBe("X'0068656C6C6F3A68656C6C6F7C30'")
    expect(
      fromDuckDBBlob({ toString: () => 'x0068656C6C6F3A68656C6C6F7C30', bytes: new Uint8Array([0x78]) }),
    ).toBe('hello:hello|0')
  })
})
