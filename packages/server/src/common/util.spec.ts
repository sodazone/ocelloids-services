import { AnyJson } from '@/lib.js'
import { asPublicKey, asSerializable } from './util.js'

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
})
