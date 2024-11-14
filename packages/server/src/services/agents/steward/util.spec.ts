import { toMelburne } from './util.js'

describe('', () => {
  it('', () => {
    expect(toMelburne(undefined)).toBe('')
    expect(toMelburne(null)).toBe('')
    expect(toMelburne('')).toBe('')
    expect(toMelburne('lol')).toBe('lol')
    expect(toMelburne('loL')).toBe('loL')
    expect(toMelburne(100)).toBe('100')
    expect(toMelburne(200n)).toBe('200')
  })

  it('', () => {
    expect(toMelburne({ hey: 'joe' })).toBe('hey:joe')
    expect(
      toMelburne({
        type: 'ForeignAsset',
        value: 6,
      }),
    ).toBe('ForeignAsset:6')
    expect(
      toMelburne({
        type: 'Token2',
        value: 5,
      }),
    ).toBe('Token2:5')
    expect(
      toMelburne({
        type: 'xyz',
        value: {
          type: 'u4',
          value: '0x01010101',
        },
      }),
    ).toBe('xyz:u4:0x01010101')
    expect(
      toMelburne({
        type: 'xyz',
        value: {
          u4: '0x01010101',
        },
      }),
    ).toBe('xyz:u4:0x01010101')
    expect(
      toMelburne({
        type: 'xyz',
        value: {
          u4: '0x01010101',
          u8: '0x0202020202020202',
        },
      }),
    ).toBe('xyz:u4:0x01010101:u8:0x0202020202020202')
  })

  it('', () => {
    expect(
      toMelburne({
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
      toMelburne({
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
      toMelburne({
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
