import { AnyJson } from '@/lib.js'
import { asSerializable } from './util.js'

describe('utility functions', () => {
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
