import { fromHex } from 'polkadot-api/utils'
import { parseAssetFromJson } from './util.js'

describe('parseAssetFromJson', () => {
  describe('parents 0', () => {
    it('should parse local Asset Hub asset', () => {
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

    it('should parse local Bifrost asset', () => {
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
  })

  describe('parents 1', () => {
    it('should parse Bifrost asset from Bifrost', () => {
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

    it('should parse Bifrost asset from Asset Hub', () => {
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

    it('should parse Asset Hub asset from Hydration', () => {
      const locationString =
        '{"parents":1,"interior":{"type":"X3","value":[{"type":"Parachain","value":1000},{"type":"PalletInstance","value":50},{"type":"GeneralIndex","value":1984}]}}'
      expect(parseAssetFromJson('urn:ocn:polkadot:2034', locationString)).toEqual({
        network: 'urn:ocn:polkadot:1000',
        assetId: {
          type: 'string',
          value: 1984,
        },
      })
    })

    it('should return null for erc20 tokens', () => {
      const locationString = `{"parents":1,"interior":{"type":"X3","value":[
          {
            "type": "Parachain",
            "value": 2004
          },
          {
            "type": "PalletInstance",
            "value": 110
          },
          {
            "type":"AccountKey20",
            "value": {
              "key": "0x931715fee2d06333043d11f658c8ce934ac61d0c"
            }
          }
        ]}}`
      expect(parseAssetFromJson('urn:ocn:polkadot:2034', locationString)).toBeNull()
    })

    it('should parse Moonbeam native asset from Hydration', () => {
      const locationString = `{"parents":1,"interior":{"type":"X2","value":[
          {
            "type": "Parachain",
            "value": 2004
          },
          {
            "type": "PalletInstance",
            "value": 10
          }
        ]}}`
      expect(parseAssetFromJson('urn:ocn:polkadot:2034', locationString)).toEqual({
        network: 'urn:ocn:polkadot:2004',
        assetId: {
          type: 'string',
          value: 'native',
        },
      })
    })

    it('should return null for wrong cross chain multilocation', () => {
      const locationString =
        '{"parents":1,"interior":{"type":"X3","value":[{"type":"Parachain","value":0},{"type":"Parachain","value":0},{"type":"Parachain","value":0}]}}'
      expect(parseAssetFromJson('urn:ocn:polkadot:2034', locationString)).toBeNull()
    })

    it('should return null for x1 value that is not of type Parachain', () => {
      const locationString =
        '{"parents":1,"interior":{"type":"X1","value":{"type":"PalletInstance","value":10}}}'
      expect(parseAssetFromJson('urn:ocn:polkadot:2034', locationString)).toBeNull()
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
  })

  describe('parents 2', () => {
    it('should parse cross consensus multilocation between Polkadot and Kusama', () => {
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

    it('should return null multilocation between Polkadot and Ethereum', () => {
      const locationString = `{
        "parents": 2,
        "interior": {
          "type": "x2",
          "value": [
            {
              "type": "globalconsensus",
              "value": {
                "type": "ethereum",
                "value": {
                  "chain_id": "1"
                }
              }
            },
            {
              "type": "accountkey20",
              "value": {
                "key": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
              }
            }
          ]
        }
      }`
      expect(parseAssetFromJson('urn:ocn:polkadot:1000', locationString)).toBeNull()
    })

    it('should return null for interior type "here"', () => {
      const locationString = '{"parents":2,"interior":{"type":"Here"}}'
      expect(parseAssetFromJson('urn:ocn:polkadot:1000', locationString)).toBeNull()
    })

    it('should return null for interior value more than x2', () => {
      const locationString = '{"parents":2,"interior":{"type":"X3"}}'
      expect(parseAssetFromJson('urn:ocn:polkadot:1000', locationString)).toBeNull()
    })

    it('should return null for parents more than 2', () => {
      const locationString = '{"parents":3,"interior":{"type":"X3"}}'
      expect(parseAssetFromJson('urn:ocn:polkadot:1000', locationString)).toBeNull()
    })
  })
})
