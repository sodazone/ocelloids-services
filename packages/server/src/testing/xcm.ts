/* eslint-disable max-len */
import '@polkadot/api-augment/polkadot';

import { jest } from '@jest/globals';

import { from } from 'rxjs';
import { ApiPromise } from '@polkadot/api';
import { ApiDecoration } from '@polkadot/api/types';
import { TypeRegistry } from '@polkadot/types';
import type { Vec, Bytes } from '@polkadot/types';
import type {
  PolkadotCorePrimitivesOutboundHrmpMessage,
  PolkadotCorePrimitivesInboundDownwardMessage
} from '@polkadot/types/lookup';
import { ControlQuery } from '@sodazone/ocelloids';

import { testBlocksFrom } from './blocks.js';
import { messageCriteria, sendersCriteria } from '../services/monitoring/ops/criteria.js';

const registry = new TypeRegistry();

// XCMP testing mocks
const xcmpData = '0x000310010400010300a10f043205011f00034cb0a37d0a1300010300a10f043205011f00034cb0a37d000d010204000101008e7f870a8cac3fa165c8531a304fcc59c7e29aec176fb03f630ceeea397b1368';
export const xcmpSend = {
  blocks: from(testBlocksFrom('hrmp-out-1000.cbor.bin', 'asset-hub.json')),
  sendersControl: new ControlQuery(
    sendersCriteria(['14DqgdKU6Zfh1UjdU4PYwpoHi2QTp37R6djehfbhXe9zoyQT'])
  ),
  messageControl: new ControlQuery(
    messageCriteria(['2032'])
  ),
  getHrmp: () => from([
    [
      {
        recipient: {
          toNumber: () => 2032
        },
        data: registry.createType('Bytes', xcmpData)
      }
    ] as unknown as Vec<PolkadotCorePrimitivesOutboundHrmpMessage>
  ])
};

export const xcmpReceive = {
  successBlocks: from(testBlocksFrom('hrmp-in-2032-success.cbor.bin', 'interlay.json')),
  failBlocks: from(testBlocksFrom('hrmp-in-2032-fail.cbor.bin', 'interlay.json'))
};

// UMP testing mocks
const umpData = '0x03100204000000000700fcf9d8080a13000000000700fcf9d808000d01020400010100a0ce523c0e0ce46845d3fe6258d0e314e029bbcdd96e19646cc4ffd395ff0e5e';
export const umpSend = {
  blocks: from(testBlocksFrom('ump-out-1000.cbor.bin', 'asset-hub.json')),
  sendersControl: new ControlQuery(
    sendersCriteria(['14dqxCimfu8PEuneBLgZnxgyxPuMoaVto7xozL6rgSo3hGU9'])
  ),
  messageControl: new ControlQuery(
    messageCriteria(['0'])
  ),
  getUmp: () => from([
    [registry.createType('Bytes', umpData)] as Vec<Bytes>
  ])
};

export const umpReceive = {
  successBlocks: from(testBlocksFrom('ump-in-success.cbor.bin', 'polkadot.json')),
  failBlocks: from(testBlocksFrom('ump-in-fail.cbor.bin', 'polkadot.json')),
  trappedBlocks: from(testBlocksFrom('ump-0-trapped-19511591.cbor.bin', 'polkadot-1000001.json'))
};

// DMP testing mocks

const dmpSendInstructions: any = [
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

const dmpData = '0x031001040001000007504dd1dc090a130001000007504dd1dc09000d01020400010100cc5aa1bd751e2a26534fa5daf5776f63192147310e2b18c52330704f5ed0a257';
const dmpData2 = '0x03140104000100000700847207020a1300010000070084720702000d0102040001010016d0e608113c3df4420993d5cc34a8d229c49bde1cad219dd01efffbfaa029032c185f6e6f25b7f940f9dcfb3d7a222b73dea621212273519c9e5cdd8debe0034c';
export const dmpSendSingleMessageInQueue = {
  blocks: from(testBlocksFrom('dmp-out.cbor.bin', 'polkadot.json')),
  sendersControl: new ControlQuery(
    sendersCriteria(['15cwh83AvXBbuPpauQBwG1Bms7Zy5rNFeVVwtVmAfwMT8eCV'])
  ),
  messageControl: new ControlQuery(
    messageCriteria(['2000'])
  ),
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
                  msg: registry.createType('Bytes', dmpData)
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
  sendersControl: new ControlQuery(
    sendersCriteria(['15cwh83AvXBbuPpauQBwG1Bms7Zy5rNFeVVwtVmAfwMT8eCV'])
  ),
  messageControl: new ControlQuery(
    messageCriteria(['2000'])
  ),
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
                  msg: registry.createType('Bytes', dmpData)
                },
                {
                  sentAt: {
                    toNumber: () => 17844552
                  },
                  msg: registry.createType('Bytes', dmpData2)
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

export const dmpXcmPalletSentEvent = {
  blocks: from(testBlocksFrom('dmp-out-event-19505060.cbor.bin', 'polkadot-1000001.json')),
  sendersControl: new ControlQuery(
    sendersCriteria('*')
  ),
  messageControl: new ControlQuery(
    messageCriteria(['2034'])
  ),
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
                  msg: registry.createType('Bytes', dmpData)
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
          toHuman: () => dmpSendInstructions.concat([{SetTopic: '0x8e75728b841da22d8337ff5fadd1264f13addcdee755b01ce1a3afb9ef629b9a'}])
        },
        hash: {
          toHex: () => '0xb86bce21a8dcaadfdf6ac3c82e0c48644515ce978d2f6f37766126575fc4fe6b'
        },
        toHuman: () => ({
          'V3': dmpSendInstructions.concat([{SetTopic: '0x8e75728b841da22d8337ff5fadd1264f13addcdee755b01ce1a3afb9ef629b9a'}])
        })
      }))
    }
  } as unknown as ApiPromise
};

export const dmpReceive = {
  successBlocks: from(testBlocksFrom('dmp-in-1000-success.cbor.bin', 'asset-hub.json')),
  failBlocks: from(testBlocksFrom('dmp-in-1000-fail.cbor.bin', 'asset-hub.json')),
  trappedBlocks: from(testBlocksFrom('dmp-2034-trapped-4159643.cbor.bin', 'hydra-201.json')),
  api: {
    at: () => jest.fn()
  } as unknown as ApiPromise
};

export const relayHrmpReceive = {
  blocks: from(testBlocksFrom('relay-hrmp-19507696.cbor.bin', 'polkadot.json')),
  messageControl: new ControlQuery(
    messageCriteria(['2000', '2006', '2104'])
  ),
  origin: '2004',
  destination: '2104'
};