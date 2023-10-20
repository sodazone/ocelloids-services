/* eslint-disable max-len */
import { from } from 'rxjs';
import { ApiPromise } from '@polkadot/api';
import type { Vec } from '@polkadot/types';
// import type { SignedBlockExtended } from '@polkadot/api-derive/types';
import type { PolkadotCorePrimitivesOutboundHrmpMessage } from '@polkadot/types/lookup';
import { ControlQuery } from '@sodazone/ocelloids';

import { testBlocksFrom } from './_blocks.js';

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
