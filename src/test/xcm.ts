/* eslint-disable max-len */
import { jest } from '@jest/globals';

import { from } from 'rxjs';
import { ApiPromise } from '@polkadot/api';
import { ApiDecoration } from '@polkadot/api/types';
import type { Bytes, Vec } from '@polkadot/types';
import type {
  PolkadotCorePrimitivesOutboundHrmpMessage,
  PolkadotCorePrimitivesInboundDownwardMessage
} from '@polkadot/types/lookup';
import { ControlQuery } from '@sodazone/ocelloids';

import { testBlocksFrom } from './blocks.js';

// XCMP testing mocks

export const xcmpSend = {
  blocks: from(testBlocksFrom('hrmp-out-1000.cbor.bin', 'asset-hub.json')),
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
  successBlocks: from(testBlocksFrom('hrmp-in-2032-success.cbor.bin', 'interlay.json')),
  failBlocks: from(testBlocksFrom('hrmp-in-2032-fail.cbor.bin', 'interlay.json'))
};

// UMP testing mocks

export const umpSend = {
  blocks: from(testBlocksFrom('ump-out-1000.cbor.bin', 'asset-hub.json')),
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
  successBlocks: from(testBlocksFrom('ump-in-success.cbor.bin', 'polkadot.json')),
  failBlocks: from(testBlocksFrom('ump-in-fail.cbor.bin', 'polkadot.json'))
};

// DMP testing mocks

const dmpSendInstructions = [
  {
    'ReserveAssetDeposited': [
      {
        'id': {
          'Concrete': {
            'parents': '1',
            'interior': 'Here'
          }
        },
        'fun': {
          'Fungible': '42,359,410,000'
        }
      }
    ]
  },
  'ClearOrigin',
  {
    'BuyExecution': {
      'fees': {
        'id': {
          'Concrete': {
            'parents': '1',
            'interior': 'Here'
          }
        },
        'fun': {
          'Fungible': '42,359,410,000'
        }
      },
      'weightLimit': 'Unlimited'
    }
  },
  {
    'DepositAsset': {
      'assets': {
        'Wild': {
          'AllCounted': '1'
        }
      },
      'beneficiary': {
        'parents': '0',
        'interior': {
          'X1': {
            'AccountId32': {
              'network': null,
              'id': '0xcc5aa1bd751e2a26534fa5daf5776f63192147310e2b18c52330704f5ed0a257'
            }
          }
        }
      }
    }
  }
];

export const dmpSendSingleMessageInQueue = {
  blocks: from(testBlocksFrom('dmp-out.cbor.bin', 'polkadot.json')),
  sendersControl: new ControlQuery({
    'extrinsic.signer.id': { $in: ['15cwh83AvXBbuPpauQBwG1Bms7Zy5rNFeVVwtVmAfwMT8eCV'] }
  }),
  messageControl: new ControlQuery({
    'recipient': { $in: [2000] }
  }),
  apiPromise: {
    at: () => new Promise((resolve) => {
      resolve({
        query: {
          dmp: {
            downwardMessageQueues: () => [
              [
                {
                  sentAt: {
                    toNumber: () => 17844552
                  },
                  msg: {
                    toHex: () => '0x031'
                  }
                }
              ] as unknown as Vec<PolkadotCorePrimitivesInboundDownwardMessage>
            ]
          }
        }
      } as unknown as ApiDecoration<'promise'>);
    }),
    registry: {
      createType: jest.fn().mockImplementation(() => ({
        value: {
          toHuman: () => dmpSendInstructions
        },
        hash: {
          toHex: () => '0xb86bce21a8dcaadfdf6ac3c82e0c48644515ce978d2f6f37766126575fc4fe6b'
        },
        toHuman: () => ({
          'V3': dmpSendInstructions
        })
      }))
    }
  } as unknown as ApiPromise
};

// Insert a fake message in the queue to simulate mutliple messages in DMP queue
export const dmpSendMultipleMessagesInQueue = {
  blocks: from(testBlocksFrom('dmp-out.cbor.bin', 'polkadot.json')),
  sendersControl: new ControlQuery({
    'extrinsic.signer.id': { $in: ['15cwh83AvXBbuPpauQBwG1Bms7Zy5rNFeVVwtVmAfwMT8eCV'] }
  }),
  messageControl: new ControlQuery({
    'recipient': { $in: [2000] }
  }),
  apiPromise: {
    at: () => new Promise((resolve) => {
      resolve({
        query: {
          dmp: {
            downwardMessageQueues: () => [
              [
                {
                  sentAt: {
                    toNumber: () => 17844552
                  },
                  msg: {
                    toHex: () => '0x031001040001000007504dd1dc090a130001000007504dd1dc09000d01020400010100cc5aa1bd751e2a26534fa5daf5776f63192147310e2b18c52330704f5ed0a257'
                  }
                },
                {
                  sentAt: {
                    toNumber: () => 17844552
                  },
                  msg: {
                    toHex: () => '0x03101'
                  }
                }
              ] as unknown as Vec<PolkadotCorePrimitivesInboundDownwardMessage>
            ]
          }
        }
      } as unknown as ApiDecoration<'promise'>);
    }),
    registry: {
      createType: jest.fn((_type: string, data: {toHex: () => string}) => {
        if (data.toHex() === '0x031001040001000007504dd1dc090a130001000007504dd1dc09000d01020400010100cc5aa1bd751e2a26534fa5daf5776f63192147310e2b18c52330704f5ed0a257') {
          return {
            value: {
              toHuman: () => dmpSendInstructions
            },
            hash: {
              toHex: () => '0xb86bce21a8dcaadfdf6ac3c82e0c48644515ce978d2f6f37766126575fc4fe6b'
            },
            toHuman: () => ({
              'V3': dmpSendInstructions
            })
          };
        } else {
          return {
            value: {
              toHuman: () => []
            },
            hash: {
              toHex: () => '0x01'
            },
            toHuman: () => ({
              'V3': []
            })
          };
        }
      })
    }
  } as unknown as ApiPromise
};

export const dmpReceive = {
  successBlocks: from(testBlocksFrom('dmp-in-1000-success.cbor.bin', 'asset-hub.json')),
  failBlocks: from(testBlocksFrom('dmp-in-1000-fail.cbor.bin', 'asset-hub.json'))
};