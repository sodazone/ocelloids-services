/* eslint-disable max-len */
import { from } from 'rxjs';
import { ApiPromise } from '@polkadot/api';
import type { Vec, Bytes } from '@polkadot/types';
import type { PolkadotCorePrimitivesOutboundHrmpMessage } from '@polkadot/types/lookup';
import { ControlQuery } from '@sodazone/ocelloids';

import { testBlocksFrom } from './_blocks.js';

// XCMP testing mocks

export const xcmpSend = {
  blocks: from(testBlocksFrom('hrmp-out-1000.cbor.bin', 'assethub-metadata.json')),
  sendersControl: new ControlQuery({
    'extrinsic.signer.id': { $in: ['14DqgdKU6Zfh1UjdU4PYwpoHi2QTp37R6djehfbhXe9zoyQT'] }
  }),
  messageControl: new ControlQuery({
    'recipient': { $in: [2032] }
  }),
  apiPromise: {
    registry: {
      createType: jest.fn().mockImplementation(() => ({
        hash: {
          toHex: () => '0x19f82753eb9718974dd2d6dfc5e3b238625d012c1a8de5e3347f56079f143867'
        },
        toHuman: () => ({
          'V3': []
        })
      }))
    }
  } as unknown as ApiPromise,
  getHrmp: () => from([
    [
      {
        recipient: {
          toNumber: () => 2032
        },
        data: {
          slice: jest.fn(),
          toHex: () => '0x01'
        }
      }
    ] as unknown as Vec<PolkadotCorePrimitivesOutboundHrmpMessage>
  ])
};

export const xcmpReceive = {
  successBlocks: from(testBlocksFrom('hrmp-in-2030.cbor.bin', 'interlay-metadata.json')),
  failBlocks: from(testBlocksFrom('hrmp-in-2030-fail.cbor.bin', 'interlay-metadata.json'))
};

// UMP testing mocks

export const umpSend = {
  blocks: from(testBlocksFrom('ump-out-1000.cbor.bin', 'assethub-metadata.json')),
  sendersControl: new ControlQuery({
    'extrinsic.signer.id': { $in: ['14dqxCimfu8PEuneBLgZnxgyxPuMoaVto7xozL6rgSo3hGU9'] }
  }),
  messageControl: new ControlQuery({
    'recipient': { $in: [0] }
  }),
  apiPromise: {
    registry: {
      createType: jest.fn().mockImplementation(() => ({
        value: {
          toHuman: () => []
        },
        hash: {
          toHex: () => '0xfbc0ad07a5d82bfb829330eb25dbf93280e00fe602d5e0b93d57c0293926b041'
        },
        toHuman: () => ({
          'V3': []
        })
      }))
    }
  } as unknown as ApiPromise,
  getUmp: () => from([
    [
      {
        toHex: () => '0x01'
      }
    ] as unknown as Vec<Bytes>
  ])
};

export const umpReceive = {
  successBlocks: from(testBlocksFrom('ump-in-success.cbor.bin', 'polkadot-metadata.json')),
  failBlocks: from(testBlocksFrom('ump-in-fail.cbor.bin', 'polkadot-metadata.json'))
};