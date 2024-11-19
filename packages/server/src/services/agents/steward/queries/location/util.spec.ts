import { fromHex } from 'polkadot-api/utils'
import { parseAssetFromJson } from './util.js'

describe('utility functions', () => {
  it('should parse asset hub asset', () => {
    const locationString =
      '{"parents":0,"interior":{"type":"X2","value":[{"type":"PalletInstance","value":50},{"type":"GeneralIndex","value":"1984"}]}}'
    expect(parseAssetFromJson('urn:ocn:polkadot:1000', locationString)).toEqual({
      network: 'urn:ocn:polkadot:1000',
      assetId: {
        type: 'string',
        value: '1984',
      },
    })
  })

  describe('bifrost', () => {
    it('should parse cross chain asset', () => {
      const locationString =
        '{"parents":1,"interior":{"type":"X2","value":[{"type":"Parachain","value":2030},{"type":"GeneralKey","value":{"length":2,"data":"0x0900000000000000000000000000000000000000000000000000000000000000"}}]}}'
      expect(parseAssetFromJson('urn:ocn:polkadot:2030', locationString)).toEqual({
        network: 'urn:ocn:polkadot:2030',
        assetId: {
          type: 'data',
          value: fromHex('0x0900'),
        },
      })
    })
    it('should parse local asset', () => {
      const locationString =
        '{"parents":0,"interior":{"type":"X1","value":{"type":"GeneralKey","value":{"length":2,"data":"0x0908000000000000000000000000000000000000000000000000000000000000"}}}}'
      expect(parseAssetFromJson('urn:ocn:polkadot:2030', locationString)).toEqual({
        network: 'urn:ocn:polkadot:2030',
        assetId: {
          type: 'data',
          value: fromHex('0x0908'),
        },
      })
    })
    it('should parse native asset', () => {
      const locationString =
        '{"parents":1,"interior":{"type":"X2","value":[{"type":"Parachain","value":2030},{"type":"GeneralKey","value":{"length":2,"data":"0x0001000000000000000000000000000000000000000000000000000000000000"}}]}}'
      expect(parseAssetFromJson('urn:ocn:polkadot:1000', locationString)).toEqual({
        network: 'urn:ocn:polkadot:2030',
        assetId: {
          type: 'data',
          value: fromHex('0x0001'),
        },
      })
    })
  })

  it('should parse versioned multilocation', () => {
    const locationString = '{"type":"V3","value":{"parents":1,"interior":{"type":"Here"}}}'
    expect(parseAssetFromJson('urn:ocn:polkadot:2030', locationString)).toEqual({
      network: 'urn:ocn:polkadot:0',
      assetId: {
        type: 'string',
        value: 'native',
      },
    })
  })

  it('should parse cross consensus multilocation', () => {
    const locationString =
      '{"parents":2,"interior":{"type":"X1","value":{"type":"GlobalConsensus","value":{"type":"Kusama"}}}}'
    expect(parseAssetFromJson('urn:ocn:polkadot:1000', locationString)).toEqual({
      network: 'urn:ocn:kusama:0',
      assetId: {
        type: 'string',
        value: 'native',
      },
    })
  })

  it('should return null for wrong multilocation', () => {
    const locationString =
      '{"parents":1,"interior":{"type":"X3","value":[{"type":"Parachain","value":0},{"type":"Parachain","value":0},{"type":"Parachain","value":0}]}}'
    expect(parseAssetFromJson('urn:ocn:polkadot:2034', locationString)).toBeNull()
  })
})
