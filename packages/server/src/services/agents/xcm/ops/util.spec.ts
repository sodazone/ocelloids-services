import { types } from '@sodazone/ocelloids-sdk'

import { U8aFixed } from '@polkadot/types-codec'

import { registry } from '@/testing/xcm.js'
import {
  getBridgeHubNetworkId,
  getMessageId,
  getParaIdFromMultiLocation,
  getParaIdFromOrigin,
  getSendersFromEvent,
  getSendersFromExtrinsic,
  matchProgramByTopic,
  networkIdFromMultiLocation,
} from './util.js'
import { asVersionedXcm, fromXcmpFormat } from './xcm-format.js'

describe('xcm ops utils', () => {
  describe('getBridgeHubNetworkId', () => {
    it('should return undefined for unknown consensus', () => {
      const bid = getBridgeHubNetworkId('urn:ocn:macario:0')
      expect(bid).toBeUndefined()
    })
  })
  describe('getSendersFromExtrinsic', () => {
    it('should extract signers data for signed extrinsic', () => {
      const signerData = getSendersFromExtrinsic({
        isSigned: true,
        signer: {
          toPrimitive: () => '',
          toHex: () => '0x0',
        },
        extraSigners: [],
      } as unknown as types.ExtrinsicWithId)

      expect(signerData).toBeDefined()
    })

    it('should return undefined on unsigned extrinsic', () => {
      const signerData = getSendersFromExtrinsic({
        isSigned: false,
        extraSigners: [],
      } as unknown as types.ExtrinsicWithId)

      expect(signerData).toBeUndefined()
    })

    it('should throw error on malformed extrinsic', () => {
      expect(() =>
        getSendersFromExtrinsic({
          isSigned: true,
        } as unknown as types.ExtrinsicWithId),
      ).toThrow()
    })

    it('should get extra signers data', () => {
      const signerData = getSendersFromExtrinsic({
        isSigned: true,
        signer: {
          value: {
            toPrimitive: () => '',
            toHex: () => '0x0',
          },
        },
        extraSigners: [
          {
            type: 'test',
            address: {
              value: {
                toPrimitive: () => '',
                toHex: () => '0x0',
              },
            },
          },
          {
            type: 'test',
            address: {
              value: {
                toPrimitive: () => '',
                toHex: () => '0x0',
              },
            },
          },
        ],
      } as unknown as types.ExtrinsicWithId)

      expect(signerData).toBeDefined()
      expect(signerData?.extraSigners.length).toBe(2)
    })
  })
  describe('getSendersFromEvent', () => {
    it('should extract signers data for an event with signed extrinsic', () => {
      const signerData = getSendersFromEvent({
        extrinsic: {
          isSigned: true,
          signer: {
            toPrimitive: () => '',
            toHex: () => '0x0',
          },
          extraSigners: [],
        },
      } as unknown as types.EventWithId)

      expect(signerData).toBeDefined()
    })
    it('should return undefined for an event without extrinsic', () => {
      const signerData = getSendersFromEvent({} as unknown as types.EventWithId)

      expect(signerData).toBeUndefined()
    })
  })
  describe('getMessageId', () => {
    it('should get the message id from setTopic V3 instruction', () => {
      const messageId = getMessageId({
        type: 'V3',
        asV3: [
          {
            isSetTopic: true,
            asSetTopic: {
              toHex: () => '0x012233',
            },
          },
        ],
      } as unknown as any)
      expect(messageId).toBe('0x012233')
    })
    it('should get the message id from setTopic V4 instruction', () => {
      const messageId = getMessageId({
        type: 'V4',
        asV4: [
          {
            isSetTopic: true,
            asSetTopic: {
              toHex: () => '0x012233',
            },
          },
        ],
      } as unknown as any)
      expect(messageId).toBe('0x012233')
    })
    it('should return undefined for V3 without setTopic', () => {
      const messageId = getMessageId({
        type: 'V3',
        asV3: [
          {
            isSetTopic: false,
          },
        ],
      } as unknown as any)
      expect(messageId).toBeUndefined()
    })
    it('should return undefined for V2 instruction', () => {
      const messageId = getMessageId({
        type: 'V2',
      } as unknown as any)
      expect(messageId).toBeUndefined()
    })
  })
  describe('getParaIdFromOrigin', () => {
    it('should get para id from UMP origin', () => {
      const paraId = getParaIdFromOrigin({
        isUmp: true,
        asUmp: {
          isPara: true,
          asPara: {
            toString: () => '10',
          },
        },
      } as unknown as any)
      expect(paraId).toBe('10')
    })
    it('should return undefined from unknown origin', () => {
      expect(
        getParaIdFromOrigin({
          isUmp: true,
          asUmp: {
            isPara: false,
          },
        } as unknown as any),
      ).toBeUndefined()
      expect(
        getParaIdFromOrigin({
          isUmp: false,
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
        parents: {
          toNumber: () => 1,
        },
      } as unknown as any)
      expect(paraId).toBe('0')
    })

    it('should get paraId from V4 multi location', () => {
      for (const t of ['X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8']) {
        const paraId = getParaIdFromMultiLocation({
          interior: {
            type: t,
            [`as${t}`]: [
              {
                isParachain: true,
                asParachain: {
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
          asX1: {
            isParachain: true,
            asParachain: {
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
            [`as${t}`]: [
              {
                isParachain: true,
                asParachain: {
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
            asZZ: [],
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
          parents: {
            toNumber: () => 10,
          },
        } as unknown as any),
      ).toBeUndefined()
    })
  })

  describe('networkIdFromMultiLocation', () => {
    it('should get a network id from multi location same consensus', () => {
      const networkId = networkIdFromMultiLocation(
        {
          parents: {
            toNumber: () => 1,
          },
          interior: {
            type: 'X1',
            asX1: Array.from([
              {
                isParachain: true,
                asParachain: {
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
          parents: {
            toNumber: () => 2,
          },
          interior: {
            type: 'X1',
            asX1: Array.from([
              {
                isGlobalConsensus: true,
                asGlobalConsensus: {
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

    it('should get a network id from V4 multi location different consensus parachain', () => {
      const networkId = networkIdFromMultiLocation(
        {
          parents: {
            toNumber: () => 2,
          },
          interior: {
            type: 'X2',
            asX2: [
              {
                isGlobalConsensus: true,
                asGlobalConsensus: {
                  type: 'Espartaco',
                },
              },
              {
                isParachain: true,
                asParachain: {
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
          parents: {
            toNumber: () => 2,
          },
          interior: {
            type: 'X1',
            asX1: {
              isGlobalConsensus: true,
              asGlobalConsensus: {
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

      const xcms = fromXcmpFormat(buf, registry)
      expect(() => {
        matchProgramByTopic(xcms[0], new U8aFixed(registry, new Uint8Array(Buffer.from('0x01', 'hex'))))
      }).toThrow('Not able to match by topic for XCM V2 program.')
    })

    it('should return false V3 program without SetTopic', () => {
      const v3XcmData =
        '000310010400010300a10f043205011f00034cb0a37d0a1300010300a10f043205011f00034cb0a37d000d010204000101008e7f870a8cac3fa165c8531a304fcc59c7e29aec176fb03f630ceeea397b1368'
      const buf = new Uint8Array(Buffer.from(v3XcmData, 'hex'))

      const xcms = fromXcmpFormat(buf, registry)
      const matched = matchProgramByTopic(
        xcms[0],
        new U8aFixed(registry, new Uint8Array(Buffer.from('0x01', 'hex'))),
      )
      expect(matched).toBe(false)
    })

    it('should return true V3 program with SetTopic', () => {
      const v3XcmData =
        '03140104000100000700847207020a1300010000070084720702000d0102040001010016d0e608113c3df4420993d5cc34a8d229c49bde1cad219dd01efffbfaa029032c185f6e6f25b7f940f9dcfb3d7a222b73dea621212273519c9e5cdd8debe0034c'
      const buf = new Uint8Array(Buffer.from(v3XcmData, 'hex'))

      const xcm = asVersionedXcm(buf, registry)
      const matched = matchProgramByTopic(
        xcm,
        new U8aFixed(
          registry,
          new Uint8Array(
            Buffer.from('185f6e6f25b7f940f9dcfb3d7a222b73dea621212273519c9e5cdd8debe0034c', 'hex'),
          ),
        ),
      )
      expect(matched).toBe(true)
    })
  })
})
