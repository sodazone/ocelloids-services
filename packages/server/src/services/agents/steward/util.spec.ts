import { bigintToPaddedHex, toMelbourne } from './util.js'

describe('Precompile address', () => {
  it('should convert to precompile address', () => {
    expect(bigintToPaddedHex(112679793397406599376365943185137098326n)).toBe(
      '0xFFFFFFFF54c556bd1d0f64ec6c78f1b477525e56',
    )
  })
})

describe('Melbourne', () => {
  it('should work with primitive types', () => {
    expect(toMelbourne(undefined)).toBe('')
    expect(toMelbourne(null)).toBe('')
    expect(toMelbourne('')).toBe('')
    expect(toMelbourne('lol')).toBe('lol')
    expect(toMelbourne('loL')).toBe('loL')
    expect(toMelbourne(100)).toBe('100')
    expect(toMelbourne(200n)).toBe('200')
  })

  it('should work with structs', () => {
    expect(toMelbourne({ hey: 'joe' })).toBe('hey:joe')
    expect(
      toMelbourne({
        type: 'ForeignAsset',
        value: 6,
      }),
    ).toBe('ForeignAsset:6')
    expect(
      toMelbourne({
        type: 'Token2',
        value: 5,
      }),
    ).toBe('Token2:5')
    expect(
      toMelbourne({
        type: 'xyz',
        value: {
          type: 'u4',
          value: '0x01010101',
        },
      }),
    ).toBe('xyz:u4:0x01010101')
    expect(
      toMelbourne({
        type: 'xyz',
        value: {
          u4: '0x01010101',
        },
      }),
    ).toBe('xyz:u4:0x01010101')
    expect(
      toMelbourne({
        type: 'xyz',
        value: {
          u4: '0x01010101',
          u8: '0x0202020202020202',
        },
      }),
    ).toBe('xyz:u4:0x01010101:u8:0x0202020202020202')
    expect(toMelbourne({ type: 'Native', value: { type: 'BNC', value: undefined } })).toBe('Native:BNC')
  })

  it('should work with multi-locations', () => {
    expect(
      toMelbourne({
        parents: 1,
        interior: {
          type: 'X3',
          value: [
            {
              type: 'Parachain',
              value: 1000,
            },
            {
              type: 'PalletInstance',
              value: 50,
            },
            {
              type: 'GeneralIndex',
              value: '23',
            },
          ],
        },
      }),
    ).toBe('parents:1:interior:X3:0:Parachain:1000:1:PalletInstance:50:2:GeneralIndex:23')

    expect(
      toMelbourne({
        parents: 2,
        interior: {
          type: 'X1',
          value: {
            type: 'GlobalConsensus',
            value: {
              type: 'Kusama',
            },
          },
        },
      }),
    ).toBe('parents:2:interior:X1:GlobalConsensus:Kusama')
    expect(
      toMelbourne({
        parents: 1,
        interior: {
          X2: [
            {
              Parachain: 2030,
            },
            {
              GeneralKey: {
                length: 2,
                data: '0x0900000000000000000000000000000000000000000000000000000000000000',
              },
            },
          ],
        },
      }),
    ).toBe(
      'parents:1:interior:X2:0:Parachain:2030:1:GeneralKey:length:2:data:0x0900000000000000000000000000000000000000000000000000000000000000',
    )
  })
})
