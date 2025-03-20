import { BlockEvent, BlockExtrinsic } from '@/services/networking/substrate/types.js'
import { apiContext } from '@/testing/xcm.js'
import {
  getMessageId,
  getParaIdFromMultiLocation,
  getParaIdFromOrigin,
  getSendersFromEvent,
  getSendersFromExtrinsic,
  mapAssetsTrapped,
  matchEvent,
  matchProgramByTopic,
  networkIdFromMultiLocation,
} from './util.js'
import { asVersionedXcm, fromXcmpFormat } from './xcm-format.js'
import { testBlocksFrom } from '@/testing/blocks.js'
import { filter, firstValueFrom, from } from 'rxjs'
import { extractEvents } from '@/services/networking/substrate/index.js'

describe('xcm ops utils', () => {
  describe('getSendersFromExtrinsic', () => {
    it('should extract signers data for signed extrinsic', async () => {
      const signerData = await getSendersFromExtrinsic({
        signed: true,
        address: '12znMShnYUCy6evsKDwFumafF9WsC2qPVMxLQkioczcjqudf',
        extraSigners: [],
      } as unknown as BlockExtrinsic)

      expect(signerData).toBeDefined()
    })

    it('should return undefined on unsigned extrinsic', async () => {
      const signerData = await getSendersFromExtrinsic({
        signed: false,
        extraSigners: [],
      } as unknown as BlockExtrinsic)

      expect(signerData).toBeUndefined()
    })

    it('should throw error on malformed extrinsic', async () => {
      await expect(() =>
        getSendersFromExtrinsic({
          signed: true,
        } as unknown as BlockExtrinsic),
      ).rejects.toThrow()
    })
  })
  describe('getSendersFromEvent', () => {
    it('should extract signers data for an event with signed extrinsic', async () => {
      const signerData = await getSendersFromEvent({
        extrinsic: {
          signed: true,
          address: '12znMShnYUCy6evsKDwFumafF9WsC2qPVMxLQkioczcjqudf',
          extraSigners: [],
        },
      } as unknown as BlockEvent)

      expect(signerData).toBeDefined()
    })
    it('should return undefined for an event without extrinsic', async () => {
      const signerData = await getSendersFromEvent({} as unknown as BlockEvent)

      expect(signerData).toBeUndefined()
    })
  })
  describe('getMessageId', () => {
    it('should get the message id from setTopic V3 instruction', () => {
      const messageId = getMessageId({
        instructions: {
          type: 'V3',
          value: [
            {
              type: 'SetTopic',
              value: '0x012233',
            },
          ],
        },
      } as unknown as any)
      expect(messageId).toBe('0x012233')
    })
    it('should get the message id from setTopic V4 instruction', () => {
      const messageId = getMessageId({
        instructions: {
          type: 'V4',
          value: [
            {
              type: 'SetTopic',
              value: '0x012233',
            },
          ],
        },
      } as unknown as any)
      expect(messageId).toBe('0x012233')
    })
    it('should return undefined for V3 without setTopic', () => {
      const messageId = getMessageId({
        instructions: {
          type: 'V3',
          value: [
            {
              type: 'SomeInstruction',
            },
          ],
        },
      } as unknown as any)
      expect(messageId).toBeUndefined()
    })
    it('should return undefined for V2 instruction', () => {
      const messageId = getMessageId({
        instructions: { type: 'V2' },
      } as unknown as any)
      expect(messageId).toBeUndefined()
    })
  })
  describe('getParaIdFromOrigin', () => {
    it('should get para id from UMP origin', () => {
      const paraId = getParaIdFromOrigin({
        type: 'Ump',
        value: {
          type: 'Para',
          value: {
            toString: () => '10',
          },
        },
      } as unknown as any)
      expect(paraId).toBe('10')
    })
    it('should return undefined from unknown origin', () => {
      expect(
        getParaIdFromOrigin({
          type: 'Ump',
          value: {
            type: 'Unknown',
          },
        } as unknown as any),
      ).toBeUndefined()
      expect(
        getParaIdFromOrigin({
          type: 'Unknown',
        } as unknown as any),
      ).toBeUndefined()
    })
  })
  describe('getParaIdFromMultiLocation', () => {
    it('should get paraId from local relay multi location', () => {
      const paraId = getParaIdFromMultiLocation({
        interior: {
          type: 'Here',
        },
        parents: 1,
      } as unknown as any)
      expect(paraId).toBe('0')
    })

    it('should get paraId from V4 multi location', () => {
      for (const t of ['X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8']) {
        const paraId = getParaIdFromMultiLocation({
          interior: {
            type: t,
            value: [
              {
                type: 'Parachain',
                value: {
                  toString: () => '10',
                },
              },
            ],
          },
        } as unknown as any)
        expect(paraId).toBe('10')
      }
    })

    it('should get paraId from >V4 X1 multi location', () => {
      const paraId = getParaIdFromMultiLocation({
        interior: {
          type: 'X1',
          value: {
            type: 'Parachain',
            value: {
              toString: () => '10',
            },
          },
        },
      } as unknown as any)
      expect(paraId).toBe('10')
    })

    it('should get paraId from >V4 multi location', () => {
      for (const t of ['X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8']) {
        const paraId = getParaIdFromMultiLocation({
          interior: {
            type: t,
            value: [
              {
                type: 'Parachain',
                value: {
                  toString: () => '10',
                },
              },
            ],
          },
        } as unknown as any)
        expect(paraId).toBe('10')
      }
    })
    it('should return undefined on unknown multi location', () => {
      expect(
        getParaIdFromMultiLocation({
          interior: {
            type: 'ZZ',
            value: [],
          },
        } as unknown as any),
      ).toBeUndefined()
      expect(
        getParaIdFromMultiLocation({
          interior: {
            type: 'Here',
          },
        } as unknown as any),
      ).toBeUndefined()
      expect(
        getParaIdFromMultiLocation({
          interior: {
            type: 'Here',
          },
          parents: 10,
        } as unknown as any),
      ).toBeUndefined()
    })
  })

  describe('networkIdFromMultiLocation', () => {
    it('should get a network id from multi location same consensus', () => {
      const networkId = networkIdFromMultiLocation(
        {
          parents: 1,
          interior: {
            type: 'X1',
            value: Array.from([
              {
                type: 'Parachain',
                value: {
                  toString: () => '11',
                },
              },
            ]),
          },
        } as unknown as any,
        'urn:ocn:polkadot:10',
      )
      expect(networkId).toBe('urn:ocn:polkadot:11')
    })

    it('should get a network id from V4 multi location different consensus', () => {
      const networkId = networkIdFromMultiLocation(
        {
          parents: 2,
          interior: {
            type: 'X1',
            value: Array.from([
              {
                type: 'GlobalConsensus',
                value: {
                  type: 'Bitcoin',
                },
              },
            ]),
          },
        } as unknown as any,
        'urn:ocn:polkadot:10',
      )
      expect(networkId).toBe('urn:ocn:bitcoin:0')
    })

    it('should get a network id from ethereum native location', () => {
      const networkId = networkIdFromMultiLocation(
        {
          interior: {
            type: 'X1',
            value: { type: 'GlobalConsensus', value: { type: 'Ethereum', value: { chain_id: '1' } } },
          },
          parents: 2,
        } as unknown as any,
        'urn:ocn:polkadot:10',
      )
      expect(networkId).toBe('urn:ocn:ethereum:1')
    })

    it('should get a network id from ethereum contract location', () => {
      const networkId = networkIdFromMultiLocation(
        {
          interior: {
            type: 'X2',
            value: [
              { type: 'GlobalConsensus', value: { type: 'Ethereum', value: { chain_id: '1' } } },
              { type: 'AccountKey20', value: { key: '0x18084fba666a33d37592fa2633fd49a74dd93a88' } },
            ],
          },
          parents: 2,
        } as unknown as any,
        'urn:ocn:polkadot:10',
      )
      expect(networkId).toBe('urn:ocn:ethereum:1')
    })

    it('should get a network id from V4 multi location different consensus parachain', () => {
      const networkId = networkIdFromMultiLocation(
        {
          parents: 2,
          interior: {
            type: 'X2',
            value: [
              {
                type: 'GlobalConsensus',
                value: {
                  type: 'Espartaco',
                },
              },
              {
                type: 'Parachain',
                value: {
                  toString: () => '11',
                },
              },
            ],
          },
        } as unknown as any,
        'urn:ocn:polkadot:10',
      )
      expect(networkId).toBe('urn:ocn:espartaco:11')
    })
    it('should get a network id from V3 multi location different consensus', () => {
      const networkId = networkIdFromMultiLocation(
        {
          parents: 2,
          interior: {
            type: 'X1',
            value: {
              type: 'GlobalConsensus',
              value: {
                type: 'Espartaco',
              },
            },
          },
        } as unknown as any,
        'urn:ocn:polkadot:10',
      )
      expect(networkId).toBe('urn:ocn:espartaco:0')
    })
  })

  describe('matchProgramByTopic', () => {
    it('should throw on XCM V2 program', () => {
      const v2XcmData =
        '0002100004000000001700004b3471bb156b050a13000000001700004b3471bb156b05010300286bee0d010004000101001e08eb75720cb63fbfcbe7237c6d9b7cf6b4953518da6b38731d5bc65b9ffa32021000040000000017206d278c7e297945030a130000000017206d278c7e29794503010300286bee0d010004000101000257fd81d0a71b094c2c8d3e6c93a9b01a31a43d38408bb2c4c2b49a4c58eb01'
      const buf = new Uint8Array(Buffer.from(v2XcmData, 'hex'))

      const xcms = fromXcmpFormat(buf, apiContext)
      expect(() => {
        matchProgramByTopic(xcms[0], '0x01')
      }).toThrow('Not able to match by topic for XCM V2 program.')
    })

    it('should return false V3 program without SetTopic', () => {
      const v3XcmData =
        '000310010400010300a10f043205011f00034cb0a37d0a1300010300a10f043205011f00034cb0a37d000d010204000101008e7f870a8cac3fa165c8531a304fcc59c7e29aec176fb03f630ceeea397b1368'
      const buf = new Uint8Array(Buffer.from(v3XcmData, 'hex'))

      const xcms = fromXcmpFormat(buf, apiContext)
      const matched = matchProgramByTopic(xcms[0], '0x01')
      expect(matched).toBe(false)
    })

    it('should return true V3 program with SetTopic', () => {
      const v3XcmData =
        '03140104000100000700847207020a1300010000070084720702000d0102040001010016d0e608113c3df4420993d5cc34a8d229c49bde1cad219dd01efffbfaa029032c185f6e6f25b7f940f9dcfb3d7a222b73dea621212273519c9e5cdd8debe0034c'
      const buf = new Uint8Array(Buffer.from(v3XcmData, 'hex'))

      const xcm = asVersionedXcm(buf, apiContext)
      const matched = matchProgramByTopic(
        xcm,
        '0x185f6e6f25b7f940f9dcfb3d7a222b73dea621212273519c9e5cdd8debe0034c',
      )
      expect(matched).toBe(true)
    })
  })

  describe('mapVersionedAssets', () => {
    it('should map V5 assets', async () => {
      const assetTrappedEvent = await firstValueFrom(from(testBlocksFrom('mythos/4459187.cbor')).pipe(
        extractEvents(),
        filter(e => matchEvent(e, 'PolkadotXcm', 'AssetsTrapped'))
      ))
      const mapped = mapAssetsTrapped(assetTrappedEvent)
      expect(mapped).toBeDefined()
      expect(mapped?.assets).toBeDefined()
    })
  })
})
