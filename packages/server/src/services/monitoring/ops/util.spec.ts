import { types } from '@sodazone/ocelloids-sdk';

import {
  getMessageId,
  getParaIdFromMultiLocation,
  getParaIdFromOrigin,
  getSendersFromEvent,
  getSendersFromExtrinsic,
  networkIdFromMultiLocation,
} from './util.js';

describe('xcm ops utils', () => {
  describe('getSendersFromExtrinsic', () => {
    it('should extract signers data for signed extrinsic', () => {
      const signerData = getSendersFromExtrinsic({
        isSigned: true,
        signer: {
          toPrimitive: () => '',
          toHex: () => '0x0',
        },
        extraSigners: [],
      } as unknown as types.ExtrinsicWithId);

      expect(signerData).toBeDefined();
    });

    it('should return undefined on unsigned extrinsic', () => {
      const signerData = getSendersFromExtrinsic({
        isSigned: false,
        extraSigners: [],
      } as unknown as types.ExtrinsicWithId);

      expect(signerData).toBeUndefined();
    });

    it('should throw error on malformed extrinsic', () => {
      expect(() =>
        getSendersFromExtrinsic({
          isSigned: true,
        } as unknown as types.ExtrinsicWithId)
      ).toThrow();
    });

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
      } as unknown as types.ExtrinsicWithId);

      expect(signerData).toBeDefined();
      expect(signerData?.extraSigners.length).toBe(2);
    });
  });
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
      } as unknown as types.EventWithId);

      expect(signerData).toBeDefined();
    });
    it('should return undefined for an event without extrinsic', () => {
      const signerData = getSendersFromEvent({} as unknown as types.EventWithId);

      expect(signerData).toBeUndefined();
    });
  });
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
      } as unknown as any);
      expect(messageId).toBe('0x012233');
    });
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
      } as unknown as any);
      expect(messageId).toBe('0x012233');
    });
    it('should return undefined for V3 without setTopic', () => {
      const messageId = getMessageId({
        type: 'V3',
        asV3: [
          {
            isSetTopic: false,
          },
        ],
      } as unknown as any);
      expect(messageId).toBeUndefined();
    });
    it('should return undefined for V2 instruction', () => {
      const messageId = getMessageId({
        type: 'V2',
      } as unknown as any);
      expect(messageId).toBeUndefined();
    });
  });
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
      } as unknown as any);
      expect(paraId).toBe('10');
    });
    it('should return undefined from unknown origin', () => {
      expect(
        getParaIdFromOrigin({
          isUmp: true,
          asUmp: {
            isPara: false,
          },
        } as unknown as any)
      ).toBeUndefined();
      expect(
        getParaIdFromOrigin({
          isUmp: false,
        } as unknown as any)
      ).toBeUndefined();
    });
  });
  describe('getParaIdFromMultiLocation', () => {
    it('should get paraId from local relay multi location', () => {
      const paraId = getParaIdFromMultiLocation({
        interior: {
          type: 'Here',
        },
        parents: {
          toNumber: () => 1,
        },
      } as unknown as any);
      expect(paraId).toBe('0');
    });

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
        } as unknown as any);
        expect(paraId).toBe('10');
      }
    });

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
      } as unknown as any);
      expect(paraId).toBe('10');
    });

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
        } as unknown as any);
        expect(paraId).toBe('10');
      }
    });
    it('should return undefined on unknown multi location', () => {
      expect(
        getParaIdFromMultiLocation({
          interior: {
            type: 'ZZ',
            asZZ: [],
          },
        } as unknown as any)
      ).toBeUndefined();
      expect(
        getParaIdFromMultiLocation({
          interior: {
            type: 'Here',
          },
        } as unknown as any)
      ).toBeUndefined();
      expect(
        getParaIdFromMultiLocation({
          interior: {
            type: 'Here',
          },
          parents: {
            toNumber: () => 10,
          },
        } as unknown as any)
      ).toBeUndefined();
    });
  });
  describe('networkIdFromMultiLocation', () => {
    it('should get a network id from multi location same consensus', () => {
      const networkId = networkIdFromMultiLocation(
        {
          parents: {
            toNumber: () => 1,
          },
          interior: {
            type: 'X1',
            asX1: [
              {
                isParachain: true,
                asParachain: {
                  toString: () => '11',
                },
              },
            ],
          },
        } as unknown as any,
        'urn:ocn:polkadot:10'
      );
      expect(networkId).toBe('urn:ocn:polkadot:11');
    });
    it('should get a network id from V4 multi location different consensus', () => {
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
        'urn:ocn:polkadot:10'
      );
      expect(networkId).toBe('urn:ocn:espartaco:11');
    });
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
        'urn:ocn:polkadot:10'
      );
      expect(networkId).toBe('urn:ocn:espartaco:0');
    });
  });
});
