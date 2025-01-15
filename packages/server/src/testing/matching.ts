import {
  XcmInbound,
  XcmRelayedWithContext,
  XcmSent,
  XcmTerminusContext,
} from '../services/agents/xcm/types.js'

const originContext: XcmTerminusContext = {
  chainId: 'urn:ocn:local:1000',
  event: {},
  blockHash: '0xBEEF',
  blockNumber: '2',
  outcome: 'Success',
  error: null,
  instructions: {},
  messageData: '0x0',
  messageHash: '0xCAFE',
}

const outboundMessage: XcmSent = {
  type: 'xcm.sent',
  messageId: '0xB000',
  legs: [
    {
      from: 'urn:ocn:local:1000',
      to: 'urn:ocn:local:2000',
      relay: 'urn:ocn:local:0',
      type: 'hrmp',
    },
  ],
  destination: {
    chainId: 'urn:ocn:local:2000',
  },
  origin: originContext,
  waypoint: {
    ...originContext,
    legIndex: 0,
  },
  sender: { signer: { id: 'xyz', publicKey: '0x01' }, extraSigners: [] },
}

const inboundMessage: XcmInbound = {
  messageHash: '0xCAFE',
  messageId: '0xB000',
  chainId: 'urn:ocn:local:2000',
  outcome: 'Success',
  error: null,
  event: {},
  blockHash: '0xBEEF',
  blockNumber: '2',
}

const relayMessage: XcmRelayedWithContext = {
  messageHash: '0xCAFE',
  messageId: '0xB000',
  extrinsicPosition: 1,
  blockHash: '0x828',
  blockNumber: '5',
  recipient: 'urn:ocn:local:2000',
  origin: 'urn:ocn:local:1000',
  outcome: 'Success',
  error: null,
}

export const matchMessages = {
  origin: outboundMessage,
  relay: relayMessage,
  destination: inboundMessage,
}

const hopOrigin: XcmSent = {
  type: 'xcm.sent',
  legs: [
    { from: 'urn:ocn:local:0', to: 'urn:ocn:local:2034', type: 'hop' },
    {
      from: 'urn:ocn:local:2034',
      to: 'urn:ocn:local:1000',
      relay: 'urn:ocn:local:0',
      type: 'hrmp',
      partialMessage:
        '0x030813000002043205011f0002093d00000d0102040001010081bd2c1d40052682633fb3e67eff151b535284d1d1a9633613af14006656f42b',
    },
  ],
  waypoint: {
    chainId: 'urn:ocn:local:0',
    blockHash: '0x961d8a9cc5f8bc2d1b092d09e9045e3d85e3c186c90dbec7119ca8b5aecb86f3',
    blockNumber: '19777220',
    extrinsicPosition: undefined,
    event: {},
    outcome: 'Success',
    error: null,
    legIndex: 0,
    messageData:
      '0x000310000400010300a10f043205011f000700f2052a011300010300a10f043205011f000700f2052a010010010204010100a10f0813000002043205011f0002093d00000d0102040001010081bd2c1d40052682633fb3e67eff151b535284d1d1a9633613af14006656f42b2c2d61ceafa0f62007fe36e1029ed347f974db05be5e5baaff31736202aeaffbdf',
    instructions: {},
    messageHash: '0xba3e17a74b5454c96b426c1379e5d9f7acebc3f239bd84b066bad9e5dec26b2f',
  },
  origin: {
    chainId: 'urn:ocn:local:0',
    blockHash: '0x961d8a9cc5f8bc2d1b092d09e9045e3d85e3c186c90dbec7119ca8b5aecb86f3',
    blockNumber: '19777220',
    extrinsicPosition: undefined,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x000310000400010300a10f043205011f000700f2052a011300010300a10f043205011f000700f2052a010010010204010100a10f0813000002043205011f0002093d00000d0102040001010081bd2c1d40052682633fb3e67eff151b535284d1d1a9633613af14006656f42b2c2d61ceafa0f62007fe36e1029ed347f974db05be5e5baaff31736202aeaffbdf',
    instructions: {},
    messageHash: '0xba3e17a74b5454c96b426c1379e5d9f7acebc3f239bd84b066bad9e5dec26b2f',
  },
  destination: { chainId: 'urn:ocn:local:1000' },
  sender: undefined,
  messageId: '0x2d61ceafa0f62007fe36e1029ed347f974db05be5e5baaff31736202aeaffbdf',
}

const hopIB: XcmInbound = {
  chainId: 'urn:ocn:local:2034',
  event: {},
  messageHash: '0xba3e17a74b5454c96b426c1379e5d9f7acebc3f239bd84b066bad9e5dec26b2f',
  messageId: '0x2d61ceafa0f62007fe36e1029ed347f974db05be5e5baaff31736202aeaffbdf',
  outcome: 'Success',
  error: null,
  blockHash: '0xfcefde93bba551ab5118aa1fb954b8b3d58ee81a5eef835132f37ab72cc70987',
  blockNumber: '4624161',
  extrinsicPosition: 1,
  assetsTrapped: undefined,
}

const hopOB: XcmSent = {
  type: 'xcm.sent',
  legs: [{ from: 'urn:ocn:local:2034', to: 'urn:ocn:local:1000', relay: 'urn:ocn:local:0', type: 'hrmp' }],
  waypoint: {
    chainId: 'urn:ocn:local:2034',
    blockHash: '0xfcefde93bba551ab5118aa1fb954b8b3d58ee81a5eef835132f37ab72cc70987',
    blockNumber: '4624161',
    extrinsicPosition: 1,
    event: {},
    outcome: 'Success',
    error: null,
    legIndex: 0,
    messageData:
      '0x03100004000002043205011f0007f1d9052a010a13000002043205011f0002093d00000d0102040001010081bd2c1d40052682633fb3e67eff151b535284d1d1a9633613af14006656f42b',
    instructions: {},
    messageHash: '0x03f0f87c9f89de3b78e730e0c6af44941b3ada5446b46ff59460faa667a0c85d',
  },
  origin: {
    chainId: 'urn:ocn:local:2034',
    blockHash: '0xfcefde93bba551ab5118aa1fb954b8b3d58ee81a5eef835132f37ab72cc70987',
    blockNumber: '4624161',
    extrinsicPosition: 1,
    event: {},
    outcome: 'Success',
    error: null,
    messageData:
      '0x03100004000002043205011f0007f1d9052a010a13000002043205011f0002093d00000d0102040001010081bd2c1d40052682633fb3e67eff151b535284d1d1a9633613af14006656f42b',
    instructions: {},
    messageHash: '0x03f0f87c9f89de3b78e730e0c6af44941b3ada5446b46ff59460faa667a0c85d',
  },
  destination: { chainId: 'urn:ocn:local:1000' },
  sender: {
    signer: { id: '7HbZHW7QDL6nqhVE4YRVnmkmia1XTYfntFuGm4WyAsTijUu7', publicKey: '0x01' },
    extraSigners: [],
  },
  messageId: '0x2d61ceafa0f62007fe36e1029ed347f974db05be5e5baaff31736202aeaffbdf',
}

const hydraMoonOut: XcmSent = {
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

const hydraMoonHop: XcmInbound = {
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

const moonBifrostIn: XcmInbound = {
  blockHash: '0xB',
  blockNumber: '1000',
  event: {},
  messageHash: '0x240059deb86df51d25fcdcc91940f5c4ba83c174b1091459d9938785f5172484',
  messageId: '0x240059deb86df51d25fcdcc91940f5c4ba83c174b1091459d9938785f5172484',
  outcome: 'Success',
  chainId: 'urn:ocn:polkadot:0',
}
const moonBifrostOut: XcmSent = {
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

const hydraMoonIn: XcmInbound = {
  chainId: 'urn:ocn:polkadot:2004',
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

export const moonBifrostMessages = {
  received: moonBifrostIn,
  sent: moonBifrostOut,
}

export const hydraMoonMessages = {
  received: hydraMoonIn,
  hop: hydraMoonHop,
  sent: hydraMoonOut,
}

type RealHopMessages = {
  origin: XcmSent
  hopin: XcmInbound
  hopout: XcmSent
}

export const realHopMessages: RealHopMessages = {
  origin: hopOrigin,
  hopin: hopIB,
  hopout: hopOB,
}
