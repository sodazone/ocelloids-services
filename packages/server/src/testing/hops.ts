import { XcmInbound, XcmRelayedWithContext, XcmSent } from '@/services/agents/xcm/types/index.js'

const moonbeamSent: XcmSent = {
  legs: [
    {
      from: 'urn:ocn:polkadot:2004',
      to: 'urn:ocn:polkadot:2031',
      type: 'hop',
      relay: 'urn:ocn:polkadot:0',
    },
    {
      from: 'urn:ocn:polkadot:2031',
      to: 'urn:ocn:polkadot:2034',
      type: 'hrmp',
      partialMessage:
        '0x040813010200bd1f060200010000000000000000000000000000000000000000000000000000000000000017c4429cc84566767840000d01020400010100842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c',
      relay: 'urn:ocn:polkadot:0',
    },
  ],
  sender: {
    signer: {
      id: '0x25c5344CC258E36b2B86b750F0DA0F89a94ce054',
      publicKey: '0x25c5344CC258E36b2B86b750F0DA0F89a94ce054',
    },
    extraSigners: [],
  },
  messageId: '0x6b42484b7260c49eb396ddc3a67b6e5838aa4c0209b884450e7add4dada4c06e',
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:polkadot:2004',
    blockHash: '0xed7606fe9553759a735575f2ba82e096f24a736e8a124cdf43b7b581db57a09f',
    blockNumber: '9180107',
    txHash: '0xabe7ad63e15ff0fbc46534b5ffcd828025e3e3a99d1894916bcb6e7c41ec24e4',
    timestamp: 1736874138917,
    txPosition: 6,
    event: {
      module: 'XcmpQueue',
      name: 'XcmpMessageSent',
      value: {
        message_hash: '0x6b42484b7260c49eb396ddc3a67b6e5838aa4c0209b884450e7add4dada4c06e',
      },
      blockNumber: '9180107',
      blockHash: '0xed7606fe9553759a735575f2ba82e096f24a736e8a124cdf43b7b581db57a09f',
      blockPosition: 31,
      timestamp: 1736874138917,
      extrinsic: {
        module: 'Ethereum',
        method: 'transact',
        args: {
          transaction: {
            type: 'Legacy',
            value: {
              nonce: ['11529', '0', '0', '0'],
              gas_price: ['125000000000', '0', '0', '0'],
              gas_limit: ['20000000', '0', '0', '0'],
              action: {
                type: 'Call',
                value: '0x6971655f19dbe2da9112e50ffdde3dfdcbdf5562',
              },
              value: ['0', '0', '0', '0'],
              input:
                '0x8af0ccc500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000002e00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000160000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c778080000000000000000000000000ffffffff44bd9d2ffee20b25d1cf9e78edb6eae3000000000000000000000000000000000000000000000000000000e8d4a510000000000000000000000000000000000000000000000000807d3f8965c9f4796800000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000000006786999c000000000000000000000000e6d0ed3759709b743707dcfecae39bc180c981fe0000000000000000000000000000000000000000000000000000000000000003444f540000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000343464700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c778080000000000000000000000000ffffffff44bd9d2ffee20b25d1cf9e78edb6eae3000000000000000000000000ffffffff44bd9d2ffee20b25d1cf9e78edb6eae30000000000000000000000000000000000000000000000807d3f8965c9f4796800000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000ffffffffffffffff000000000000000000000000ffffffffea09fb06d082fd1275cd48b191cbcd1d000000000000000000000000000000000000000000000000000000000007a120000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000500000007f2000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002201842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c00000000000000000000000000000000000000000000000000000000000000',
              signature: {
                v: '2604',
                r: '0xa63df3bc54949adba351ba612271485bb1f6d71eb7665e1a247b316dd779cd21',
                s: '0x5485217e519f374b574a5f12b1950db18caff1dc9189db940716b3210ee12a69',
              },
            },
          },
        },
        signed: false,
        hash: '0xabe7ad63e15ff0fbc46534b5ffcd828025e3e3a99d1894916bcb6e7c41ec24e4',
        blockNumber: '9180107',
        blockHash: '0xed7606fe9553759a735575f2ba82e096f24a736e8a124cdf43b7b581db57a09f',
        blockPosition: 5,
        timestamp: 1736874138917,
        evmTxHash: '0x5dcc191ea036a5e3a7e9730b7ebe70f1e0c47c939d718c64b9c2c398082c6f57',
      },
      extrinsicPosition: 6,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x041000040001060200010000000000000000000000000000000000000000000000000000000000000017878538918bccecf0800a130001060200010000000000000000000000000000000000000000000000000000000000000017c3429cc84566767840000e010204010100c91f0813010200bd1f060200010000000000000000000000000000000000000000000000000000000000000017c4429cc84566767840000d01020400010100842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c',
    instructions: {
      type: 'V4',
      value: [
        {
          type: 'WithdrawAsset',
          value: [
            {
              id: {
                parents: 0,
                interior: {
                  type: 'X1',
                  value: {
                    type: 'GeneralKey',
                    value: {
                      length: 2,
                      data: '0x0001000000000000000000000000000000000000000000000000000000000000',
                    },
                  },
                },
              },
              fun: {
                type: 'Fungible',
                value: '2378543716998237947271',
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
                parents: 0,
                interior: {
                  type: 'X1',
                  value: {
                    type: 'GeneralKey',
                    value: {
                      length: 2,
                      data: '0x0001000000000000000000000000000000000000000000000000000000000000',
                    },
                  },
                },
              },
              fun: {
                type: 'Fungible',
                value: '1189271858499118973635',
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
              parents: 1,
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
                      parents: 1,
                      interior: {
                        type: 'X2',
                        value: [
                          {
                            type: 'Parachain',
                            value: 2031,
                          },
                          {
                            type: 'GeneralKey',
                            value: {
                              length: 2,
                              data: '0x0001000000000000000000000000000000000000000000000000000000000000',
                            },
                          },
                        ],
                      },
                    },
                    fun: {
                      type: 'Fungible',
                      value: '1189271858499118973636',
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
                          id: '0x842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c',
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
    messageHash: '0x6b42484b7260c49eb396ddc3a67b6e5838aa4c0209b884450e7add4dada4c06e',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:polkadot:2004',
    blockHash: '0xed7606fe9553759a735575f2ba82e096f24a736e8a124cdf43b7b581db57a09f',
    blockNumber: '9180107',
    txHash: '0xabe7ad63e15ff0fbc46534b5ffcd828025e3e3a99d1894916bcb6e7c41ec24e4',
    timestamp: 1736874138917,
    txPosition: 6,
    event: {
      module: 'XcmpQueue',
      name: 'XcmpMessageSent',
      value: {
        message_hash: '0x6b42484b7260c49eb396ddc3a67b6e5838aa4c0209b884450e7add4dada4c06e',
      },
      blockNumber: '9180107',
      blockHash: '0xed7606fe9553759a735575f2ba82e096f24a736e8a124cdf43b7b581db57a09f',
      blockPosition: 31,
      timestamp: 1736874138917,
      extrinsic: {
        module: 'Ethereum',
        method: 'transact',
        args: {
          transaction: {
            type: 'Legacy',
            value: {
              nonce: ['11529', '0', '0', '0'],
              gas_price: ['125000000000', '0', '0', '0'],
              gas_limit: ['20000000', '0', '0', '0'],
              action: {
                type: 'Call',
                value: '0x6971655f19dbe2da9112e50ffdde3dfdcbdf5562',
              },
              value: ['0', '0', '0', '0'],
              input:
                '0x8af0ccc500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000002e00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000160000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c778080000000000000000000000000ffffffff44bd9d2ffee20b25d1cf9e78edb6eae3000000000000000000000000000000000000000000000000000000e8d4a510000000000000000000000000000000000000000000000000807d3f8965c9f4796800000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000000006786999c000000000000000000000000e6d0ed3759709b743707dcfecae39bc180c981fe0000000000000000000000000000000000000000000000000000000000000003444f540000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000343464700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c778080000000000000000000000000ffffffff44bd9d2ffee20b25d1cf9e78edb6eae3000000000000000000000000ffffffff44bd9d2ffee20b25d1cf9e78edb6eae30000000000000000000000000000000000000000000000807d3f8965c9f4796800000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000ffffffffffffffff000000000000000000000000ffffffffea09fb06d082fd1275cd48b191cbcd1d000000000000000000000000000000000000000000000000000000000007a120000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000500000007f2000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002201842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c00000000000000000000000000000000000000000000000000000000000000',
              signature: {
                v: '2604',
                r: '0xa63df3bc54949adba351ba612271485bb1f6d71eb7665e1a247b316dd779cd21',
                s: '0x5485217e519f374b574a5f12b1950db18caff1dc9189db940716b3210ee12a69',
              },
            },
          },
        },
        signed: false,
        hash: '0xabe7ad63e15ff0fbc46534b5ffcd828025e3e3a99d1894916bcb6e7c41ec24e4',
        blockNumber: '9180107',
        blockHash: '0xed7606fe9553759a735575f2ba82e096f24a736e8a124cdf43b7b581db57a09f',
        blockPosition: 5,
        timestamp: 1736874138917,
        evmTxHash: '0x5dcc191ea036a5e3a7e9730b7ebe70f1e0c47c939d718c64b9c2c398082c6f57',
      },
      extrinsicPosition: 6,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x041000040001060200010000000000000000000000000000000000000000000000000000000000000017878538918bccecf0800a130001060200010000000000000000000000000000000000000000000000000000000000000017c3429cc84566767840000e010204010100c91f0813010200bd1f060200010000000000000000000000000000000000000000000000000000000000000017c4429cc84566767840000d01020400010100842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c',
    instructions: {
      type: 'V4',
      value: [
        {
          type: 'WithdrawAsset',
          value: [
            {
              id: {
                parents: 0,
                interior: {
                  type: 'X1',
                  value: {
                    type: 'GeneralKey',
                    value: {
                      length: 2,
                      data: '0x0001000000000000000000000000000000000000000000000000000000000000',
                    },
                  },
                },
              },
              fun: {
                type: 'Fungible',
                value: '2378543716998237947271',
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
                parents: 0,
                interior: {
                  type: 'X1',
                  value: {
                    type: 'GeneralKey',
                    value: {
                      length: 2,
                      data: '0x0001000000000000000000000000000000000000000000000000000000000000',
                    },
                  },
                },
              },
              fun: {
                type: 'Fungible',
                value: '1189271858499118973635',
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
              parents: 1,
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
                      parents: 1,
                      interior: {
                        type: 'X2',
                        value: [
                          {
                            type: 'Parachain',
                            value: 2031,
                          },
                          {
                            type: 'GeneralKey',
                            value: {
                              length: 2,
                              data: '0x0001000000000000000000000000000000000000000000000000000000000000',
                            },
                          },
                        ],
                      },
                    },
                    fun: {
                      type: 'Fungible',
                      value: '1189271858499118973636',
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
                          id: '0x842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c',
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
    messageHash: '0x6b42484b7260c49eb396ddc3a67b6e5838aa4c0209b884450e7add4dada4c06e',
  },
  destination: {
    chainId: 'urn:ocn:polkadot:2034',
  },
}

const moonbeamRelayed: XcmRelayedWithContext = {
  txPosition: 1,
  blockNumber: '24286514',
  blockHash: '0xb6bc4da1bdfc0b6e63ae00ccbbf51e934a4f28b09bf394a9c3422094796b5ef9',
  timestamp: 1736874144000,
  messageHash: '0x6b42484b7260c49eb396ddc3a67b6e5838aa4c0209b884450e7add4dada4c06e',
  messageData:
    '0x041000040001060200010000000000000000000000000000000000000000000000000000000000000017878538918bccecf0800a130001060200010000000000000000000000000000000000000000000000000000000000000017c3429cc84566767840000e010204010100c91f0813010200bd1f060200010000000000000000000000000000000000000000000000000000000000000017c4429cc84566767840000d01020400010100842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c',
  messageId: '0x6b42484b7260c49eb396ddc3a67b6e5838aa4c0209b884450e7add4dada4c06e',
  recipient: 'urn:ocn:polkadot:2031',
  origin: 'urn:ocn:polkadot:2004',
  outcome: 'Success',
}

const centrifugeHopIn: XcmInbound = {
  messageId: '0x6b42484b7260c49eb396ddc3a67b6e5838aa4c0209b884450e7add4dada4c06e',
  chainId: 'urn:ocn:polkadot:2031',
  blockHash: '0x1a3db2bd28b4045a9c9d7914d5c27a9706e3b45cbe82b8bc2808fd44e3b8576a',
  blockNumber: '7118135',
  timestamp: 1736874162000,
  event: {
    module: 'MessageQueue',
    name: 'Processed',
    value: {
      id: '0x6b42484b7260c49eb396ddc3a67b6e5838aa4c0209b884450e7add4dada4c06e',
      origin: {
        type: 'Sibling',
        value: 2004,
      },
      weight_used: {
        ref_time: '800000000',
        proof_size: '0',
      },
      success: true,
    },
    blockNumber: '7118135',
    blockHash: '0x1a3db2bd28b4045a9c9d7914d5c27a9706e3b45cbe82b8bc2808fd44e3b8576a',
    blockPosition: 10,
    timestamp: 1736874162000,
  },
  outcome: 'Success',
  messageData:
    '0x041000040001060200010000000000000000000000000000000000000000000000000000000000000017878538918bccecf0800a130001060200010000000000000000000000000000000000000000000000000000000000000017c3429cc84566767840000e010204010100c91f0813010200bd1f060200010000000000000000000000000000000000000000000000000000000000000017c4429cc84566767840000d01020400010100842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c',
  messageHash: '0x6b42484b7260c49eb396ddc3a67b6e5838aa4c0209b884450e7add4dada4c06e',
}

const centrifugeRelayed: XcmRelayedWithContext = {
  txPosition: 1,
  blockNumber: '24286518',
  blockHash: '0x0fa3eba67a26f696b438a031bcb7154ad18f1b848da0df70818da564fec8c508',
  timestamp: 1736874168001,
  messageHash: '0x5d2854398144a9dd7aa9b51a03f40b3344237bfa01d0bcc98250391b61c623d3',
  messageData:
    '0x0310010400010200bd1f06020001000000000000000000000000000000000000000000000000000000000000001787452ca9dbf4d5f0800a1300010200bd1f060200010000000000000000000000000000000000000000000000000000000000000017c4429cc84566767840000d01020400010100842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c',
  messageId: '0x5d2854398144a9dd7aa9b51a03f40b3344237bfa01d0bcc98250391b61c623d3',
  recipient: 'urn:ocn:polkadot:2034',
  origin: 'urn:ocn:polkadot:2031',
  outcome: 'Success',
}

const centrifugeHopOut: XcmSent = {
  legs: [
    {
      from: 'urn:ocn:polkadot:2031',
      to: 'urn:ocn:polkadot:2034',
      type: 'hrmp',
      relay: 'urn:ocn:polkadot:0',
    },
  ],
  messageId: '0x5d2854398144a9dd7aa9b51a03f40b3344237bfa01d0bcc98250391b61c623d3',
  type: 'xcm.sent',
  waypoint: {
    chainId: 'urn:ocn:polkadot:2031',
    blockHash: '0x1a3db2bd28b4045a9c9d7914d5c27a9706e3b45cbe82b8bc2808fd44e3b8576a',
    blockNumber: '7118135',
    timestamp: 1736874162000,
    event: {
      module: 'XcmpQueue',
      name: 'XcmpMessageSent',
      value: {
        message_hash: '0x5d2854398144a9dd7aa9b51a03f40b3344237bfa01d0bcc98250391b61c623d3',
      },
      blockNumber: '7118135',
      blockHash: '0x1a3db2bd28b4045a9c9d7914d5c27a9706e3b45cbe82b8bc2808fd44e3b8576a',
      blockPosition: 8,
      timestamp: 1736874162000,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x0310010400010200bd1f06020001000000000000000000000000000000000000000000000000000000000000001787452ca9dbf4d5f0800a1300010200bd1f060200010000000000000000000000000000000000000000000000000000000000000017c4429cc84566767840000d01020400010100842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c',
    instructions: {
      type: 'V3',
      value: [
        {
          type: 'ReserveAssetDeposited',
          value: [
            {
              id: {
                type: 'Concrete',
                value: {
                  parents: 1,
                  interior: {
                    type: 'X2',
                    value: [
                      {
                        type: 'Parachain',
                        value: 2031,
                      },
                      {
                        type: 'GeneralKey',
                        value: {
                          length: 2,
                          data: '0x0001000000000000000000000000000000000000000000000000000000000000',
                        },
                      },
                    ],
                  },
                },
              },
              fun: {
                type: 'Fungible',
                value: '2378537287398237947271',
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
                  parents: 1,
                  interior: {
                    type: 'X2',
                    value: [
                      {
                        type: 'Parachain',
                        value: 2031,
                      },
                      {
                        type: 'GeneralKey',
                        value: {
                          length: 2,
                          data: '0x0001000000000000000000000000000000000000000000000000000000000000',
                        },
                      },
                    ],
                  },
                },
              },
              fun: {
                type: 'Fungible',
                value: '1189271858499118973636',
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
                    id: '0x842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c',
                  },
                },
              },
            },
          },
        },
      ],
    },
    messageHash: '0x5d2854398144a9dd7aa9b51a03f40b3344237bfa01d0bcc98250391b61c623d3',
    legIndex: 0,
  },
  origin: {
    chainId: 'urn:ocn:polkadot:2031',
    blockHash: '0x1a3db2bd28b4045a9c9d7914d5c27a9706e3b45cbe82b8bc2808fd44e3b8576a',
    blockNumber: '7118135',
    timestamp: 1736874162000,
    event: {
      module: 'XcmpQueue',
      name: 'XcmpMessageSent',
      value: {
        message_hash: '0x5d2854398144a9dd7aa9b51a03f40b3344237bfa01d0bcc98250391b61c623d3',
      },
      blockNumber: '7118135',
      blockHash: '0x1a3db2bd28b4045a9c9d7914d5c27a9706e3b45cbe82b8bc2808fd44e3b8576a',
      blockPosition: 8,
      timestamp: 1736874162000,
    },
    outcome: 'Success',
    error: null,
    messageData:
      '0x0310010400010200bd1f06020001000000000000000000000000000000000000000000000000000000000000001787452ca9dbf4d5f0800a1300010200bd1f060200010000000000000000000000000000000000000000000000000000000000000017c4429cc84566767840000d01020400010100842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c',
    instructions: {
      type: 'V3',
      value: [
        {
          type: 'ReserveAssetDeposited',
          value: [
            {
              id: {
                type: 'Concrete',
                value: {
                  parents: 1,
                  interior: {
                    type: 'X2',
                    value: [
                      {
                        type: 'Parachain',
                        value: 2031,
                      },
                      {
                        type: 'GeneralKey',
                        value: {
                          length: 2,
                          data: '0x0001000000000000000000000000000000000000000000000000000000000000',
                        },
                      },
                    ],
                  },
                },
              },
              fun: {
                type: 'Fungible',
                value: '2378537287398237947271',
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
                  parents: 1,
                  interior: {
                    type: 'X2',
                    value: [
                      {
                        type: 'Parachain',
                        value: 2031,
                      },
                      {
                        type: 'GeneralKey',
                        value: {
                          length: 2,
                          data: '0x0001000000000000000000000000000000000000000000000000000000000000',
                        },
                      },
                    ],
                  },
                },
              },
              fun: {
                type: 'Fungible',
                value: '1189271858499118973636',
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
                    id: '0x842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c',
                  },
                },
              },
            },
          },
        },
      ],
    },
    messageHash: '0x5d2854398144a9dd7aa9b51a03f40b3344237bfa01d0bcc98250391b61c623d3',
  },
  destination: {
    chainId: 'urn:ocn:polkadot:2034',
  },
}

const hydraReceived: XcmInbound = {
  messageId: '0x5d2854398144a9dd7aa9b51a03f40b3344237bfa01d0bcc98250391b61c623d3',
  chainId: 'urn:ocn:polkadot:2034',
  blockNumber: '6772320',
  blockHash: '0x7960509fbc86168feae05e327ee85aa656be94ba563f17215c9f5963c7ea49d1',
  timestamp: 1736874192000,
  event: {
    module: 'MessageQueue',
    name: 'Processed',
    value: {
      id: '0x5d2854398144a9dd7aa9b51a03f40b3344237bfa01d0bcc98250391b61c623d3',
      origin: {
        type: 'Sibling',
        value: 2031,
      },
      weight_used: {
        ref_time: '400000000',
        proof_size: '0',
      },
      success: true,
    },
    blockNumber: '6772320',
    blockHash: '0x7960509fbc86168feae05e327ee85aa656be94ba563f17215c9f5963c7ea49d1',
    blockPosition: 9,
    timestamp: 1736874192000,
  },
  outcome: 'Success',
  messageData:
    '0x0310010400010200bd1f06020001000000000000000000000000000000000000000000000000000000000000001787452ca9dbf4d5f0800a1300010200bd1f060200010000000000000000000000000000000000000000000000000000000000000017c4429cc84566767840000d01020400010100842745b99b8042d28a7c677d9469332bfc24aa5266c7ec57c43c7af125a0c16c',
  messageHash: '0x5d2854398144a9dd7aa9b51a03f40b3344237bfa01d0bcc98250391b61c623d3',
}

export const moonbeamCentrifugeHydra = {
  sent: moonbeamSent,
  relay0: moonbeamRelayed,
  hopIn: centrifugeHopIn,
  relay1: centrifugeRelayed,
  hopOut: centrifugeHopOut,
  received: hydraReceived,
}
