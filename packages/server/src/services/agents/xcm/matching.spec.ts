import { MemoryLevel as Level } from 'memory-level'

import { Egress } from '@/services/egress/index.js'
import { Janitor } from '@/services/persistence/level/janitor.js'
import { Services } from '@/services/types.js'
import { matchHopMessages, matchMessages, realHopMessages } from '@/testing/matching.js'
import { createServices } from '@/testing/services.js'

import { MatchingEngine } from './matching.js'
import { XcmInbound, XcmNotificationType, XcmSent } from './types.js'

const hydraSent: XcmSent = {
  subscriptionId: 'hydra-transfers',
  legs: [
    {
      from: 'urn:ocn:polkadot:2034',
      to: 'urn:ocn:polkadot:0',
      type: 'hop',
    },
    {
      from: 'urn:ocn:polkadot:0',
      to: 'urn:ocn:polkadot:2004',
      type: 'vmp',
      partialMessage:
        '0x030813000100000718740e9904000d01020400010300ba6d211834c09cf3da51f1b5ad1e5552ad79311b',
    },
  ],
  messageId: '0x14b6fef098897c6d335007cf8dd967edb578bf00a36df5c33c2b3a824661b864',
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:polkadot:2034',
    blockHash: '0x4dacb898ade25ea66b3e015b7517f8ac9ef34b02763fd35c8d5f40b327f33d12',
    blockNumber: '6766437',
    extrinsicHash: '0xf9be9bc98b5c1e722ec3a28105a898160597de99bc982e87e62702e4be6e35ae',
    timestamp: 1736792244000,
    extrinsicPosition: 3,
    event: {
      module: 'ParachainSystem',
      name: 'UpwardMessageSent',
      value: {
        message_hash: '0x14b6fef098897c6d335007cf8dd967edb578bf00a36df5c33c2b3a824661b864',
      },
      blockNumber: '6766437',
      blockHash: '0x4dacb898ade25ea66b3e015b7517f8ac9ef34b02763fd35c8d5f40b327f33d12',
      blockPosition: 52,
      timestamp: 1736792244000,
      extrinsic: {
        module: 'MultiTransactionPayment',
        method: 'dispatch_permit',
        args: {
          from: '0xba6d211834c09cf3da51f1b5ad1e5552ad79311b',
          to: '0x0000000000000000000000000000000000000401',
          value: ['0', '0', '0', '0'],
          data: '0x89000500000030e81c3209000000000000000000000004010200511f0300ba6d211834c09cf3da51f1b5ad1e5552ad79311b00',
          gas_limit: '40320',
          deadline: ['1736795820', '0', '0', '0'],
          v: 27,
          r: '0x3bbd5b4630b52671816bbb2f0de793ee7f3b2166cfc7cbaedfef1c9173536da3',
          s: '0x7f7a0c7ad5a870ab1a6d831232805c80bc20ac5f0721a7ff826dca8a4c38647e',
        },
        signed: false,
        hash: '0xf9be9bc98b5c1e722ec3a28105a898160597de99bc982e87e62702e4be6e35ae',
        blockNumber: '6766437',
        blockHash: '0x4dacb898ade25ea66b3e015b7517f8ac9ef34b02763fd35c8d5f40b327f33d12',
        blockPosition: 3,
        timestamp: 1736792244000,
      },
      extrinsicPosition: 3,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x03100004000000000730e81c32090a13000000000718740e9904000e010204000100511f0813000100000718740e9904000d01020400010300ba6d211834c09cf3da51f1b5ad1e5552ad79311b',
    instructions: {
      type: 'V3',
      value: [
        {
          type: 'WithdrawAsset',
          value: [
            {
              id: {
                type: 'Concrete',
                value: {
                  parents: 0,
                  interior: {
                    type: 'Here',
                  },
                },
              },
              fun: {
                type: 'Fungible',
                value: '39495460912',
              },
            },
          ],
        },
        {
          type: 'ClearOrigin',
        },
        {
          type: 'BuyExecution',
          value: {
            fees: {
              id: {
                type: 'Concrete',
                value: {
                  parents: 0,
                  interior: {
                    type: 'Here',
                  },
                },
              },
              fun: {
                type: 'Fungible',
                value: '19747730456',
              },
            },
            weight_limit: {
              type: 'Unlimited',
            },
          },
        },
        {
          type: 'DepositReserveAsset',
          value: {
            assets: {
              type: 'Wild',
              value: {
                type: 'AllCounted',
                value: 1,
              },
            },
            dest: {
              parents: 0,
              interior: {
                type: 'X1',
                value: {
                  type: 'Parachain',
                  value: 2004,
                },
              },
            },
            xcm: [
              {
                type: 'BuyExecution',
                value: {
                  fees: {
                    id: {
                      type: 'Concrete',
                      value: {
                        parents: 1,
                        interior: {
                          type: 'Here',
                        },
                      },
                    },
                    fun: {
                      type: 'Fungible',
                      value: '19747730456',
                    },
                  },
                  weight_limit: {
                    type: 'Unlimited',
                  },
                },
              },
              {
                type: 'DepositAsset',
                value: {
                  assets: {
                    type: 'Wild',
                    value: {
                      type: 'AllCounted',
                      value: 1,
                    },
                  },
                  beneficiary: {
                    parents: 0,
                    interior: {
                      type: 'X1',
                      value: {
                        type: 'AccountKey20',
                        value: {
                          key: '0xba6d211834c09cf3da51f1b5ad1e5552ad79311b',
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
    messageHash: '0x14b6fef098897c6d335007cf8dd967edb578bf00a36df5c33c2b3a824661b864',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:polkadot:2034',
    blockHash: '0x4dacb898ade25ea66b3e015b7517f8ac9ef34b02763fd35c8d5f40b327f33d12',
    blockNumber: '6766437',
    extrinsicHash: '0xf9be9bc98b5c1e722ec3a28105a898160597de99bc982e87e62702e4be6e35ae',
    timestamp: 1736792244000,
    extrinsicPosition: 3,
    event: {
      module: 'ParachainSystem',
      name: 'UpwardMessageSent',
      value: {
        message_hash: '0x14b6fef098897c6d335007cf8dd967edb578bf00a36df5c33c2b3a824661b864',
      },
      blockNumber: '6766437',
      blockHash: '0x4dacb898ade25ea66b3e015b7517f8ac9ef34b02763fd35c8d5f40b327f33d12',
      blockPosition: 52,
      timestamp: 1736792244000,
      extrinsic: {
        module: 'MultiTransactionPayment',
        method: 'dispatch_permit',
        args: {
          from: '0xba6d211834c09cf3da51f1b5ad1e5552ad79311b',
          to: '0x0000000000000000000000000000000000000401',
          value: ['0', '0', '0', '0'],
          data: '0x89000500000030e81c3209000000000000000000000004010200511f0300ba6d211834c09cf3da51f1b5ad1e5552ad79311b00',
          gas_limit: '40320',
          deadline: ['1736795820', '0', '0', '0'],
          v: 27,
          r: '0x3bbd5b4630b52671816bbb2f0de793ee7f3b2166cfc7cbaedfef1c9173536da3',
          s: '0x7f7a0c7ad5a870ab1a6d831232805c80bc20ac5f0721a7ff826dca8a4c38647e',
        },
        signed: false,
        hash: '0xf9be9bc98b5c1e722ec3a28105a898160597de99bc982e87e62702e4be6e35ae',
        blockNumber: '6766437',
        blockHash: '0x4dacb898ade25ea66b3e015b7517f8ac9ef34b02763fd35c8d5f40b327f33d12',
        blockPosition: 3,
        timestamp: 1736792244000,
      },
      extrinsicPosition: 3,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x03100004000000000730e81c32090a13000000000718740e9904000e010204000100511f0813000100000718740e9904000d01020400010300ba6d211834c09cf3da51f1b5ad1e5552ad79311b',
    instructions: {
      type: 'V3',
      value: [
        {
          type: 'WithdrawAsset',
          value: [
            {
              id: {
                type: 'Concrete',
                value: {
                  parents: 0,
                  interior: {
                    type: 'Here',
                  },
                },
              },
              fun: {
                type: 'Fungible',
                value: '39495460912',
              },
            },
          ],
        },
        {
          type: 'ClearOrigin',
        },
        {
          type: 'BuyExecution',
          value: {
            fees: {
              id: {
                type: 'Concrete',
                value: {
                  parents: 0,
                  interior: {
                    type: 'Here',
                  },
                },
              },
              fun: {
                type: 'Fungible',
                value: '19747730456',
              },
            },
            weight_limit: {
              type: 'Unlimited',
            },
          },
        },
        {
          type: 'DepositReserveAsset',
          value: {
            assets: {
              type: 'Wild',
              value: {
                type: 'AllCounted',
                value: 1,
              },
            },
            dest: {
              parents: 0,
              interior: {
                type: 'X1',
                value: {
                  type: 'Parachain',
                  value: 2004,
                },
              },
            },
            xcm: [
              {
                type: 'BuyExecution',
                value: {
                  fees: {
                    id: {
                      type: 'Concrete',
                      value: {
                        parents: 1,
                        interior: {
                          type: 'Here',
                        },
                      },
                    },
                    fun: {
                      type: 'Fungible',
                      value: '19747730456',
                    },
                  },
                  weight_limit: {
                    type: 'Unlimited',
                  },
                },
              },
              {
                type: 'DepositAsset',
                value: {
                  assets: {
                    type: 'Wild',
                    value: {
                      type: 'AllCounted',
                      value: 1,
                    },
                  },
                  beneficiary: {
                    parents: 0,
                    interior: {
                      type: 'X1',
                      value: {
                        type: 'AccountKey20',
                        value: {
                          key: '0xba6d211834c09cf3da51f1b5ad1e5552ad79311b',
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
    messageHash: '0x14b6fef098897c6d335007cf8dd967edb578bf00a36df5c33c2b3a824661b864',
  },
  destination: {
    chainId: 'urn:ocn:polkadot:2004',
  },
}

const hydraHop: XcmInbound = {
  subscriptionId: 'hydra-transfers',
  messageId: '0x14b6fef098897c6d335007cf8dd967edb578bf00a36df5c33c2b3a824661b864',
  chainId: 'urn:ocn:polkadot:0',
  blockHash: '0x5366b3cfbb1f861ecf22d9300b73cda4c7e8e397620b7057bbc7e0c42127d73a',
  blockNumber: '24272894',
  timestamp: 1736792256000,
  event: {
    module: 'MessageQueue',
    name: 'Processed',
    value: {
      id: '0x14b6fef098897c6d335007cf8dd967edb578bf00a36df5c33c2b3a824661b864',
      origin: {
        type: 'Ump',
        value: {
          type: 'Para',
          value: 2034,
        },
      },
      weight_used: {
        ref_time: '558768000',
        proof_size: '7186',
      },
      success: true,
    },
    blockNumber: '24272894',
    blockHash: '0x5366b3cfbb1f861ecf22d9300b73cda4c7e8e397620b7057bbc7e0c42127d73a',
    blockPosition: 55,
    timestamp: 1736792256000,
  },
  outcome: 'Success',
  messageHash: '0x14b6fef098897c6d335007cf8dd967edb578bf00a36df5c33c2b3a824661b864',
}

const polkadotFromMoonbeamToBifrostIn: XcmInbound = {
  blockHash: '0xB',
  blockNumber: '1000',
  event: {},
  messageHash: '0x240059deb86df51d25fcdcc91940f5c4ba83c174b1091459d9938785f5172484',
  messageId: '0x240059deb86df51d25fcdcc91940f5c4ba83c174b1091459d9938785f5172484',
  outcome: 'Success',
  chainId: 'urn:ocn:polkadot:0',
  subscriptionId: 'moonbeam-transfers',
}
const moonbeamToBifrostSent: XcmSent = {
  subscriptionId: 'moonbeam-transfers',
  legs: [
    {
      from: 'urn:ocn:polkadot:2004',
      to: 'urn:ocn:polkadot:0',
      type: 'hop',
    },
    {
      from: 'urn:ocn:polkadot:0',
      to: 'urn:ocn:polkadot:2034',
      type: 'vmp',
      partialMessage:
        '0x0308130001000007f9e731f143000d0102040001010024a1b9d4bd6be959c5d55e66f3be0f6591c38b9801cb64f000009e5842e61628',
    },
  ],
  sender: {
    signer: {
      id: '0xba6d211834C09cf3Da51F1B5aD1E5552aD79311B',
      publicKey: '0xba6d211834C09cf3Da51F1B5aD1E5552aD79311B',
    },
    extraSigners: [],
  },
  messageId: '0x240059deb86df51d25fcdcc91940f5c4ba83c174b1091459d9938785f5172484',
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:polkadot:2004',
    blockHash: '0x119cf482222c9b6046df5dd8ea85ffb07f270554ec7036aee1f4e4340b8f9ea0',
    blockNumber: '9166868',
    extrinsicHash: '0x7640b7a383f947e5f4a5e62eb1a1951631dab2dcb4d317c0ccf851e3535317af',
    timestamp: 1736792802499,
    extrinsicPosition: 2,
    event: {
      module: 'ParachainSystem',
      name: 'UpwardMessageSent',
      value: {
        message_hash: '0x240059deb86df51d25fcdcc91940f5c4ba83c174b1091459d9938785f5172484',
      },
      blockNumber: '9166868',
      blockHash: '0x119cf482222c9b6046df5dd8ea85ffb07f270554ec7036aee1f4e4340b8f9ea0',
      blockPosition: 772,
      timestamp: 1736792802499,
      extrinsic: {
        module: 'Ethereum',
        method: 'transact',
        args: {
          transaction: {
            type: 'EIP1559',
            value: {
              chain_id: '1284',
              nonce: ['78', '0', '0', '0'],
              max_priority_fee_per_gas: ['125000000000', '0', '0', '0'],
              max_fee_per_gas: ['125000000000', '0', '0', '0'],
              gas_limit: ['79353', '0', '0', '0'],
              action: {
                type: 'Call',
                value: '0x0000000000000000000000000000000000000804',
              },
              value: ['0', '0', '0', '0'],
              input:
                '0xb9f813ff000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c77808000000000000000000000000000000000000000000000000000000087e263cff10000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000ffffffffffffffff00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000500000007f200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000220124a1b9d4bd6be959c5d55e66f3be0f6591c38b9801cb64f000009e5842e6162800000000000000000000000000000000000000000000000000000000000000',
              access_list: [],
              odd_y_parity: false,
              r: '0xd79fd8e8682de174d0ba89488d0cceae91eca05ce4c7fb945e4efb432c46ad06',
              s: '0x1495300eb83a8c078b05427a2b6fc9ffb27b52988dd1a833867efc2ab3e50867',
            },
          },
        },
        signed: false,
        hash: '0x7640b7a383f947e5f4a5e62eb1a1951631dab2dcb4d317c0ccf851e3535317af',
        blockNumber: '9166868',
        blockHash: '0x119cf482222c9b6046df5dd8ea85ffb07f270554ec7036aee1f4e4340b8f9ea0',
        blockPosition: 4,
        timestamp: 1736792802499,
        evmTxHash: '0xc07dfb4a746f86ceecebd7ea305b8f5216982b6afffc76cbd7bb8c3ed4f8d2b4',
      },
      extrinsicPosition: 2,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x031000040000000007f1cf63e2870a130000000007f8e731f143000e010204000100c91f08130001000007f9e731f143000d0102040001010024a1b9d4bd6be959c5d55e66f3be0f6591c38b9801cb64f000009e5842e61628',
    instructions: {
      type: 'V3',
      value: [
        {
          type: 'WithdrawAsset',
          value: [
            {
              id: {
                type: 'Concrete',
                value: {
                  parents: 0,
                  interior: {
                    type: 'Here',
                  },
                },
              },
              fun: {
                type: 'Fungible',
                value: '583618777073',
              },
            },
          ],
        },
        {
          type: 'ClearOrigin',
        },
        {
          type: 'BuyExecution',
          value: {
            fees: {
              id: {
                type: 'Concrete',
                value: {
                  parents: 0,
                  interior: {
                    type: 'Here',
                  },
                },
              },
              fun: {
                type: 'Fungible',
                value: '291809388536',
              },
            },
            weight_limit: {
              type: 'Unlimited',
            },
          },
        },
        {
          type: 'DepositReserveAsset',
          value: {
            assets: {
              type: 'Wild',
              value: {
                type: 'AllCounted',
                value: 1,
              },
            },
            dest: {
              parents: 0,
              interior: {
                type: 'X1',
                value: {
                  type: 'Parachain',
                  value: 2034,
                },
              },
            },
            xcm: [
              {
                type: 'BuyExecution',
                value: {
                  fees: {
                    id: {
                      type: 'Concrete',
                      value: {
                        parents: 1,
                        interior: {
                          type: 'Here',
                        },
                      },
                    },
                    fun: {
                      type: 'Fungible',
                      value: '291809388537',
                    },
                  },
                  weight_limit: {
                    type: 'Unlimited',
                  },
                },
              },
              {
                type: 'DepositAsset',
                value: {
                  assets: {
                    type: 'Wild',
                    value: {
                      type: 'AllCounted',
                      value: 1,
                    },
                  },
                  beneficiary: {
                    parents: 0,
                    interior: {
                      type: 'X1',
                      value: {
                        type: 'AccountId32',
                        value: {
                          id: '0x24a1b9d4bd6be959c5d55e66f3be0f6591c38b9801cb64f000009e5842e61628',
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
    messageHash: '0x240059deb86df51d25fcdcc91940f5c4ba83c174b1091459d9938785f5172484',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:polkadot:2004',
    blockHash: '0x119cf482222c9b6046df5dd8ea85ffb07f270554ec7036aee1f4e4340b8f9ea0',
    blockNumber: '9166868',
    extrinsicHash: '0x7640b7a383f947e5f4a5e62eb1a1951631dab2dcb4d317c0ccf851e3535317af',
    timestamp: 1736792802499,
    extrinsicPosition: 2,
    event: {
      module: 'ParachainSystem',
      name: 'UpwardMessageSent',
      value: {
        message_hash: '0x240059deb86df51d25fcdcc91940f5c4ba83c174b1091459d9938785f5172484',
      },
      blockNumber: '9166868',
      blockHash: '0x119cf482222c9b6046df5dd8ea85ffb07f270554ec7036aee1f4e4340b8f9ea0',
      blockPosition: 772,
      timestamp: 1736792802499,
      extrinsic: {
        module: 'Ethereum',
        method: 'transact',
        args: {
          transaction: {
            type: 'EIP1559',
            value: {
              chain_id: '1284',
              nonce: ['78', '0', '0', '0'],
              max_priority_fee_per_gas: ['125000000000', '0', '0', '0'],
              max_fee_per_gas: ['125000000000', '0', '0', '0'],
              gas_limit: ['79353', '0', '0', '0'],
              action: {
                type: 'Call',
                value: '0x0000000000000000000000000000000000000804',
              },
              value: ['0', '0', '0', '0'],
              input:
                '0xb9f813ff000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c77808000000000000000000000000000000000000000000000000000000087e263cff10000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000ffffffffffffffff00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000500000007f200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000220124a1b9d4bd6be959c5d55e66f3be0f6591c38b9801cb64f000009e5842e6162800000000000000000000000000000000000000000000000000000000000000',
              access_list: [],
              odd_y_parity: false,
              r: '0xd79fd8e8682de174d0ba89488d0cceae91eca05ce4c7fb945e4efb432c46ad06',
              s: '0x1495300eb83a8c078b05427a2b6fc9ffb27b52988dd1a833867efc2ab3e50867',
            },
          },
        },
        signed: false,
        hash: '0x7640b7a383f947e5f4a5e62eb1a1951631dab2dcb4d317c0ccf851e3535317af',
        blockNumber: '9166868',
        blockHash: '0x119cf482222c9b6046df5dd8ea85ffb07f270554ec7036aee1f4e4340b8f9ea0',
        blockPosition: 4,
        timestamp: 1736792802499,
        evmTxHash: '0xc07dfb4a746f86ceecebd7ea305b8f5216982b6afffc76cbd7bb8c3ed4f8d2b4',
      },
      extrinsicPosition: 2,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x031000040000000007f1cf63e2870a130000000007f8e731f143000e010204000100c91f08130001000007f9e731f143000d0102040001010024a1b9d4bd6be959c5d55e66f3be0f6591c38b9801cb64f000009e5842e61628',
    instructions: {
      type: 'V3',
      value: [
        {
          type: 'WithdrawAsset',
          value: [
            {
              id: {
                type: 'Concrete',
                value: {
                  parents: 0,
                  interior: {
                    type: 'Here',
                  },
                },
              },
              fun: {
                type: 'Fungible',
                value: '583618777073',
              },
            },
          ],
        },
        {
          type: 'ClearOrigin',
        },
        {
          type: 'BuyExecution',
          value: {
            fees: {
              id: {
                type: 'Concrete',
                value: {
                  parents: 0,
                  interior: {
                    type: 'Here',
                  },
                },
              },
              fun: {
                type: 'Fungible',
                value: '291809388536',
              },
            },
            weight_limit: {
              type: 'Unlimited',
            },
          },
        },
        {
          type: 'DepositReserveAsset',
          value: {
            assets: {
              type: 'Wild',
              value: {
                type: 'AllCounted',
                value: 1,
              },
            },
            dest: {
              parents: 0,
              interior: {
                type: 'X1',
                value: {
                  type: 'Parachain',
                  value: 2034,
                },
              },
            },
            xcm: [
              {
                type: 'BuyExecution',
                value: {
                  fees: {
                    id: {
                      type: 'Concrete',
                      value: {
                        parents: 1,
                        interior: {
                          type: 'Here',
                        },
                      },
                    },
                    fun: {
                      type: 'Fungible',
                      value: '291809388537',
                    },
                  },
                  weight_limit: {
                    type: 'Unlimited',
                  },
                },
              },
              {
                type: 'DepositAsset',
                value: {
                  assets: {
                    type: 'Wild',
                    value: {
                      type: 'AllCounted',
                      value: 1,
                    },
                  },
                  beneficiary: {
                    parents: 0,
                    interior: {
                      type: 'X1',
                      value: {
                        type: 'AccountId32',
                        value: {
                          id: '0x24a1b9d4bd6be959c5d55e66f3be0f6591c38b9801cb64f000009e5842e61628',
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
    messageHash: '0x240059deb86df51d25fcdcc91940f5c4ba83c174b1091459d9938785f5172484',
  },
  destination: {
    chainId: 'urn:ocn:polkadot:2034',
  },
}

const moonbeamIn: XcmInbound = {
  chainId: 'urn:ocn:polkadot:2004',
  subscriptionId: 'hydra-transfers',
  event: {
    module: 'MessageQueue',
    name: 'Processed',
    value: {
      id: '0x3023923f007de86a3c62bf0224a36408ca4e79446174c87696aa6ef15d33b741',
      origin: {},
      weight_used: {},
      success: true,
    },
    blockHash: '0x8d888845172f05b928bf9cd4699a9ba3dccf8bbbb23de5afb555125e034fa58e',
    blockNumber: '9166777',
    blockPosition: 41,
    timestamp: 1736792256430,
  },
  extrinsicPosition: undefined,
  blockNumber: '9166777',
  blockHash: '0x8d888845172f05b928bf9cd4699a9ba3dccf8bbbb23de5afb555125e034fa58e',
  timestamp: 1736792256430,
  messageHash: '0x3023923f007de86a3c62bf0224a36408ca4e79446174c87696aa6ef15d33b741',
  messageId: '0x3023923f007de86a3c62bf0224a36408ca4e79446174c87696aa6ef15d33b741',
  extrinsicHash: undefined,
  outcome: 'Success',
  messageData:
    '0x04140104010000079ed68518090a130100000718740e9904000d01020400010300ba6d211834c09cf3da51f1b5ad1e5552ad79311b2ca67a693ad9f9547015177f90a29846374271580a4a8d5251d49eb269cadf6935',
  error: undefined,
  assetsTrapped: undefined,
}

describe('message matching engine', () => {
  let engine: MatchingEngine
  let db: Level
  let services: Services

  const msgTypeCb = vi.fn()
  const cb = vi.fn((msg) => msgTypeCb(msg.type))
  const schedule = vi.fn()

  function expectEvents(events: XcmNotificationType[]) {
    for (const [i, event] of events.entries()) {
      expect(msgTypeCb).toHaveBeenNthCalledWith<[XcmNotificationType]>(i + 1, event)
    }
  }

  beforeAll(() => {
    services = createServices()
  })

  beforeEach(() => {
    vi.clearAllMocks()

    db = new Level()
    engine = new MatchingEngine(
      {
        ...services,
        egress: {} as unknown as Egress,
        db,
        janitor: {
          on: vi.fn(),
          schedule,
        } as unknown as Janitor,
      },
      cb,
    )
  })

  it('should match inbound and outbound', async () => {
    const { origin, destination } = matchMessages

    await engine.onOutboundMessage(origin)
    await engine.onInboundMessage(destination)

    expectEvents(['xcm.sent', 'xcm.received'])
  })

  it('should match outbound and inbound', async () => {
    const { origin, destination } = matchMessages

    await engine.onInboundMessage(destination)
    await engine.onOutboundMessage(origin)

    expectEvents(['xcm.sent', 'xcm.received'])
  })

  it('should match relay inbound and outbound', async () => {
    await engine.onInboundMessage(polkadotFromMoonbeamToBifrostIn)
    await engine.onOutboundMessage(moonbeamToBifrostSent)

    expectEvents(['xcm.sent', 'xcm.hop'])
  })

  it('should skip duplicated outbound message', async () => {
    const { origin } = matchMessages

    await engine.onOutboundMessage(origin)
    await engine.onOutboundMessage(origin)

    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('should work async concurrently', async () => {
    const { origin, destination } = matchMessages

    await Promise.all([engine.onOutboundMessage(origin), engine.onInboundMessage(destination)])

    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('should match outbound and relay', async () => {
    await engine.onOutboundMessage(matchMessages.origin)
    await engine.onRelayedMessage(matchMessages.subscriptionId, matchMessages.relay)

    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('should match relay and outbound', async () => {
    await engine.onRelayedMessage(matchMessages.subscriptionId, matchMessages.relay)
    await engine.onOutboundMessage(matchMessages.origin)
    expect(schedule).toHaveBeenCalledTimes(2)

    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('should match relay and outbound and inbound', async () => {
    const { origin, relay, destination, subscriptionId } = matchMessages

    await engine.onRelayedMessage(subscriptionId, relay)
    await engine.onOutboundMessage(origin)
    await engine.onInboundMessage(destination)

    expect(schedule).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenCalledTimes(3)
  })

  it('should match outbound and inbound by message hash', async () => {
    const { origin, destination } = matchMessages
    const omsg: XcmSent = {
      ...origin,
      messageId: undefined,
    }
    const imsg: XcmInbound = {
      ...destination,
      messageId: destination.messageHash,
    }

    await engine.onOutboundMessage(omsg)
    await engine.onInboundMessage(imsg)

    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('should match with messageId on outbound and only message hash on inbound', async () => {
    const { origin, destination } = matchMessages
    const imsg: XcmInbound = {
      ...destination,
      messageId: destination.messageHash,
    }

    await engine.onOutboundMessage(origin)
    await engine.onInboundMessage(imsg)

    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('should match hop messages', async () => {
    const { origin, relay0, hopin, hopout, relay2, destination, subscriptionId } = matchHopMessages

    await engine.onOutboundMessage(origin)
    await engine.onRelayedMessage(subscriptionId, relay0)

    await engine.onInboundMessage(hopin)
    await engine.onOutboundMessage(hopout)
    await engine.onRelayedMessage(subscriptionId, relay2)
    await engine.onInboundMessage(destination)

    expect(cb).toHaveBeenCalledTimes(6)
  })

  it('should match hop messages with topic id', async () => {
    const { origin, hopin, hopout } = realHopMessages

    await engine.onOutboundMessage(origin)
    await engine.onInboundMessage(hopin)
    await engine.onOutboundMessage(hopout)

    expectEvents(['xcm.sent', 'xcm.hop', 'xcm.hop'])
  })

  it('should match hop messages without topic id', async () => {
    const { origin, hopin, hopout } = realHopMessages

    delete origin.messageId
    delete hopin.messageId
    delete hopout.messageId

    await engine.onOutboundMessage(origin)
    await engine.onInboundMessage(hopin)
    await engine.onOutboundMessage(hopout)

    expectEvents(['xcm.sent', 'xcm.hop', 'xcm.hop'])
  })

  it('should match hop messages turbot', async () => {
    await engine.onOutboundMessage(hydraSent)
    await engine.onInboundMessage(hydraHop)
    await engine.onInboundMessage(moonbeamIn)

    expectEvents(['xcm.sent', 'xcm.hop', 'xcm.received'])
  })

  it('should match hop messages with concurrent message on hop stop', async () => {
    const { origin, relay0, hopin, hopout, relay2, destination, subscriptionId } = matchHopMessages

    await engine.onOutboundMessage(origin)
    await engine.onRelayedMessage(subscriptionId, relay0)
    await Promise.all([engine.onInboundMessage(hopin), engine.onOutboundMessage(hopout)])
    await engine.onRelayedMessage(subscriptionId, relay2)
    await engine.onInboundMessage(destination)

    expectEvents(['xcm.sent', 'xcm.relayed', 'xcm.hop', 'xcm.hop', 'xcm.relayed', 'xcm.received'])
  })

  it('should match hop messages with concurrent message on hop stop and relay out of order', async () => {
    const { origin, relay0, hopin, hopout, relay2, destination, subscriptionId } = matchHopMessages

    await engine.onRelayedMessage(subscriptionId, relay0)
    await engine.onOutboundMessage(origin)
    await engine.onRelayedMessage(subscriptionId, relay2)

    await Promise.all([engine.onInboundMessage(hopin), engine.onOutboundMessage(hopout)])

    await engine.onInboundMessage(destination)

    expect(cb).toHaveBeenCalledTimes(6)
  })

  it('should clean up stale data', async () => {
    async function count() {
      const iterator = db.iterator()
      await iterator.all()
      return iterator.count
    }

    for (let i = 0; i < 100; i++) {
      await engine.onInboundMessage({
        ...matchMessages.destination,
        subscriptionId: 'z.transfers:' + i,
      })
      await engine.onOutboundMessage({
        ...matchMessages.origin,
        subscriptionId: 'baba-yaga-1:' + i,
      })
      const r = (Math.random() + 1).toString(36).substring(7)
      await engine.onOutboundMessage({
        ...matchMessages.origin,
        subscriptionId: r + i,
      })
    }
    expect(await count()).toBe(600)

    for (let i = 0; i < 100; i++) {
      await engine.clearPendingStates('z.transfers:' + i)
      await engine.clearPendingStates('baba-yaga-1:' + i)
    }
    expect(await count()).toBe(200)
  })
})
