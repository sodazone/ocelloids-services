import { CrosschainIssuanceInputs } from '../types.js'

const issuanceInputs: CrosschainIssuanceInputs[] = [
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 'native',
    reserveAddress: '1jMhfSJv5MkSQmEq97UmXCmMV63SHoQ3ednwkRSKETrCREU',
    reserveDecimals: 10,
    remoteChain: 'urn:ocn:ethereum:1',
    remoteAssetId: '0x196c20da81fbc324ecdf55501e95ce9f0bd84d14',
    remoteDecimals: 10,
    assetSymbol: 'DOT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 'native',
    reserveAddress: '13cKp89U6Aoy86UbfQipph1BBTjyxErNYd4pRqfK4TcLeUXg',
    reserveDecimals: 10,
    remoteChain: 'urn:ocn:polkadot:2031',
    remoteAssetId: {
      type: 'ForeignAsset',
      value: 5,
    },
    remoteDecimals: 10,
    assetSymbol: 'DOT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 'native',
    reserveAddress: '13cKp89TtYknbyYnqnF6dWN75q5ZosvFSuqzoEVkUAaNR47A',
    reserveDecimals: 10,
    remoteChain: 'urn:ocn:polkadot:2030',
    remoteAssetId: {
      type: 'Token2',
      value: 0,
    },
    remoteDecimals: 10,
    assetSymbol: 'DOT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 'native',
    reserveAddress: '13cKp88n27dzGussks75PWsnuKzQf4iMJSee31yvDBVvWDmU',
    reserveDecimals: 10,
    remoteChain: 'urn:ocn:polkadot:3367',
    remoteAssetId: '0x628bf3596747d233f1e6533345700066bf458fa48daedaf04a7be6c392902476',
    remoteDecimals: 10,
    assetSymbol: 'DOT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 'native',
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 10,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X1',
        value: {
          type: 'GlobalConsensus',
          value: {
            type: 'Polkadot',
          },
        },
      },
    },
    remoteDecimals: 10,
    assetSymbol: 'DOT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 'native',
    reserveAddress: '13cKp89P5dSS97HR8gme172QkfBaMDXK5rYHegYGH7m6yxhA',
    reserveDecimals: 10,
    remoteChain: 'urn:ocn:polkadot:2006',
    remoteAssetId: '340282366920938463463374607431768211455',
    remoteDecimals: 10,
    assetSymbol: 'DOT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 'native',
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 10,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFF1fcacbd218edc0eba20fc2308c778080',
    remoteDecimals: 10,
    assetSymbol: 'DOT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 'native',
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 10,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 5,
    remoteDecimals: 10,
    assetSymbol: 'DOT',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x0e186357c323c806c1efdad36d217f7a54b63d18',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x0e186357c323c806c1efdad36d217f7a54b63d18',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'CGT2.0',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x0e186357c323c806c1efdad36d217f7a54b63d18',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x0e186357c323c806c1efdad36d217f7a54b63d18',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'CGT2.0',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x18084fba666a33d37592fa2633fd49a74dd93a88',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x18084fba666a33d37592fa2633fd49a74dd93a88',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'tBTC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x18084fba666a33d37592fa2633fd49a74dd93a88',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x18084fba666a33d37592fa2633fd49a74dd93a88',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'tBTC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x18084fba666a33d37592fa2633fd49a74dd93a88',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000765,
    remoteDecimals: 18,
    assetSymbol: 'tBTC',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x1abaea1f7c830bd89acc67ec4af516284b1bc33c',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x1abaea1f7c830bd89acc67ec4af516284b1bc33c',
            },
          },
        ],
      },
    },
    remoteDecimals: 6,
    assetSymbol: 'EURC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x1abaea1f7c830bd89acc67ec4af516284b1bc33c',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x1abaea1f7c830bd89acc67ec4af516284b1bc33c',
            },
          },
        ],
      },
    },
    remoteDecimals: 6,
    assetSymbol: 'EURC',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 8,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            },
          },
        ],
      },
    },
    remoteDecimals: 8,
    assetSymbol: 'WBTC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 8,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            },
          },
        ],
      },
    },
    remoteDecimals: 8,
    assetSymbol: 'WBTC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 8,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFF1b4bb1ac5749f73d866ffc91a3432c47',
    remoteDecimals: 8,
    assetSymbol: 'WBTC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 8,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000190,
    remoteDecimals: 8,
    assetSymbol: 'WBTC',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x45804880de22913dafe09f4980848ece6ecbaf78',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x45804880de22913dafe09f4980848ece6ecbaf78',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'PAXG',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x45804880de22913dafe09f4980848ece6ecbaf78',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 39,
    remoteDecimals: 18,
    assetSymbol: 'PAXG',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x514910771af9ca656af840dff83e8264ecf986ca',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x514910771af9ca656af840dff83e8264ecf986ca',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'LINK',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x514910771af9ca656af840dff83e8264ecf986ca',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x514910771af9ca656af840dff83e8264ecf986ca',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'LINK',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x514910771af9ca656af840dff83e8264ecf986ca',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000794,
    remoteDecimals: 18,
    assetSymbol: 'LINK',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x56072c95faa701256059aa122697b133aded9279',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x56072c95faa701256059aa122697b133aded9279',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'SKY',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x56072c95faa701256059aa122697b133aded9279',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x56072c95faa701256059aa122697b133aded9279',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'SKY',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x56072c95faa701256059aa122697b133aded9279',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000795,
    remoteDecimals: 18,
    assetSymbol: 'SKY',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x57e114b691db790c35207b2e685d4a43181e6061',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x57e114b691db790c35207b2e685d4a43181e6061',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'ENA',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x57e114b691db790c35207b2e685d4a43181e6061',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 38,
    remoteDecimals: 18,
    assetSymbol: 'ENA',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x582d872a1b094fc48f5de31d3b73f2d9be47def1',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 9,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x582d872a1b094fc48f5de31d3b73f2d9be47def1',
            },
          },
        ],
      },
    },
    remoteDecimals: 9,
    assetSymbol: 'TONCOIN',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x582d872a1b094fc48f5de31d3b73f2d9be47def1',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 9,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x582d872a1b094fc48f5de31d3b73f2d9be47def1',
            },
          },
        ],
      },
    },
    remoteDecimals: 9,
    assetSymbol: 'TONCOIN',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x5a98fcbea516cf06857215779fd812ca3bef1b32',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x5a98fcbea516cf06857215779fd812ca3bef1b32',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'LDO',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x5a98fcbea516cf06857215779fd812ca3bef1b32',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x5a98fcbea516cf06857215779fd812ca3bef1b32',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'LDO',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x5a98fcbea516cf06857215779fd812ca3bef1b32',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000796,
    remoteDecimals: 18,
    assetSymbol: 'LDO',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x5d3d01fd6d2ad1169b17918eb4f153c6616288eb',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 15,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x5d3d01fd6d2ad1169b17918eb4f153c6616288eb',
            },
          },
        ],
      },
    },
    remoteDecimals: 15,
    assetSymbol: 'KILT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x5d3d01fd6d2ad1169b17918eb4f153c6616288eb',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 15,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x5d3d01fd6d2ad1169b17918eb4f153c6616288eb',
            },
          },
        ],
      },
    },
    remoteDecimals: 15,
    assetSymbol: 'KILT',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'PEPE',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'PEPE',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x6b175474e89094c44da98b954eedeac495271d0f',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x6b175474e89094c44da98b954eedeac495271d0f',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'DAI',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x6b175474e89094c44da98b954eedeac495271d0f',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x6b175474e89094c44da98b954eedeac495271d0f',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'DAI',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x6b175474e89094c44da98b954eedeac495271d0f',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFF9de12e6658c49b4834f9278f6a39f5d7',
    remoteDecimals: 18,
    assetSymbol: 'DAI',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x7de91b204c1c737bcee6f000aaa6569cf7061cb7',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 9,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x7de91b204c1c737bcee6f000aaa6569cf7061cb7',
            },
          },
        ],
      },
    },
    remoteDecimals: 9,
    assetSymbol: 'XRT',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'wstETH',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'wstETH',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFF5d5deb44bf7278dee5381beb24cb6573',
    remoteDecimals: 18,
    assetSymbol: 'wstETH',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000809,
    remoteDecimals: 18,
    assetSymbol: 'wstETH',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'AAVE',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'AAVE',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000624,
    remoteDecimals: 18,
    assetSymbol: 'AAVE',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x8236a87084f8b84306f72007f36f2618a5634494',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 8,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x8236a87084f8b84306f72007f36f2618a5634494',
            },
          },
        ],
      },
    },
    remoteDecimals: 8,
    assetSymbol: 'LBTC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x8236a87084f8b84306f72007f36f2618a5634494',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 8,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x8236a87084f8b84306f72007f36f2618a5634494',
            },
          },
        ],
      },
    },
    remoteDecimals: 8,
    assetSymbol: 'LBTC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x8236a87084f8b84306f72007f36f2618a5634494',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 8,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000851,
    remoteDecimals: 8,
    assetSymbol: 'LBTC',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x8daebade922df735c38c80c7ebd708af50815faa',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x8daebade922df735c38c80c7ebd708af50815faa',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'TBTC',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'SHIB',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0x9d39a5de30e57443bff2a8307a4256c8797a3497',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x9d39a5de30e57443bff2a8307a4256c8797a3497',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'sUSDe',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x9d39a5de30e57443bff2a8307a4256c8797a3497',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x9d39a5de30e57443bff2a8307a4256c8797a3497',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'sUSDe',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0x9d39a5de30e57443bff2a8307a4256c8797a3497',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000625,
    remoteDecimals: 18,
    assetSymbol: 'sUSDe',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            },
          },
        ],
      },
    },
    remoteDecimals: 6,
    assetSymbol: 'USDC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            },
          },
        ],
      },
    },
    remoteDecimals: 6,
    assetSymbol: 'USDC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000766,
    remoteDecimals: 6,
    assetSymbol: 'USDC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFF166f84967f054ae95ab5764c38cf3aed',
    remoteDecimals: 6,
    assetSymbol: 'USDC',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'sUSDS',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'sUSDS',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000626,
    remoteDecimals: 18,
    assetSymbol: 'sUSDS',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0xaa7a9ca87d3694b5755f213b5d04094b8d0f0a6f',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xaa7a9ca87d3694b5755f213b5d04094b8d0f0a6f',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'TRAC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xaa7a9ca87d3694b5755f213b5d04094b8d0f0a6f',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 35,
    remoteDecimals: 18,
    assetSymbol: 'TRAC',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0xba41ddf06b7ffd89d1267b5a93bfef2424eb2003',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xba41ddf06b7ffd89d1267b5a93bfef2424eb2003',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'MYTH',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89TtYknbyYnqnF6dWN75q5ZosvFSuqzoEVkUAaNR47A',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2030',
    remoteAssetId: {
      type: 'Token2',
      value: 13,
    },
    remoteDecimals: 18,
    assetSymbol: 'WETH',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'WETH',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'WETH',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFF86829afe1521ad2296719df3ace8ded7',
    remoteDecimals: 18,
    assetSymbol: 'WETH',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000189,
    remoteDecimals: 18,
    assetSymbol: 'WETH',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0xcccccccccc33d538dbc2ee4feab0a7a1ff4e8a94',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xcccccccccc33d538dbc2ee4feab0a7a1ff4e8a94',
            },
          },
        ],
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'CFG',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xcccccccccc33d538dbc2ee4feab0a7a1ff4e8a94',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 41,
    remoteDecimals: 18,
    assetSymbol: 'CFG',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            },
          },
        ],
      },
    },
    remoteDecimals: 6,
    assetSymbol: 'USDT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            },
          },
        ],
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            },
          },
        ],
      },
    },
    remoteDecimals: 6,
    assetSymbol: 'USDT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000767,
    remoteDecimals: 6,
    assetSymbol: 'USDT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'GlobalConsensus',
            value: {
              type: 'Ethereum',
              value: {
                chain_id: '1',
              },
            },
          },
          {
            type: 'AccountKey20',
            value: {
              key: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            },
          },
        ],
      },
    },
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFF7bc304425217b49e9598415c514ae81b',
    remoteDecimals: 6,
    assetSymbol: 'USDT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X1',
        value: {
          type: 'GlobalConsensus',
          value: {
            type: 'Ethereum',
            value: {
              chain_id: '1',
            },
          },
        },
      },
    },
    reserveAddress: '13cKp89TtYknbyYnqnF6dWN75q5ZosvFSuqzoEVkUAaNR47A',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2030',
    remoteAssetId: {
      type: 'Token2',
      value: 15,
    },
    remoteDecimals: 18,
    assetSymbol: 'ETH',
  },
  {
    reserveChain: 'urn:ocn:ethereum:1',
    reserveAssetId: 'native',
    reserveAddress: '0xd803472c47a87D7B63E888DE53f03B4191B846a8',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X1',
        value: {
          type: 'GlobalConsensus',
          value: {
            type: 'Ethereum',
            value: {
              chain_id: '1',
            },
          },
        },
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'ETH',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X1',
        value: {
          type: 'GlobalConsensus',
          value: {
            type: 'Ethereum',
            value: {
              chain_id: '1',
            },
          },
        },
      },
    },
    reserveAddress: '12GvRkNCmXFuaaziTJ2ZKAfa7MArKfLT2HYvLjQuepP3JuHf',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:kusama:1000',
    remoteAssetId: {
      parents: 2,
      interior: {
        type: 'X1',
        value: {
          type: 'GlobalConsensus',
          value: {
            type: 'Ethereum',
            value: {
              chain_id: '1',
            },
          },
        },
      },
    },
    remoteDecimals: 18,
    assetSymbol: 'ETH',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X1',
        value: {
          type: 'GlobalConsensus',
          value: {
            type: 'Ethereum',
            value: {
              chain_id: '1',
            },
          },
        },
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 34,
    remoteDecimals: 18,
    assetSymbol: 'ETH',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: {
      parents: 2,
      interior: {
        type: 'X1',
        value: {
          type: 'GlobalConsensus',
          value: {
            type: 'Ethereum',
            value: {
              chain_id: '1',
            },
          },
        },
      },
    },
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFFaff6df83d0a1935dda2e5f1f402c0c45',
    remoteDecimals: 18,
    assetSymbol: 'ETH',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 1337,
    reserveAddress: '13cKp89UHns9eDQQV3CZ1seFH6QQ6bnVeLHe4SpsekeJse1r',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2032',
    remoteAssetId: 12,
    remoteDecimals: 6,
    assetSymbol: 'USDC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 1337,
    reserveAddress: '13cKp89U6Aoy86UbfQipph1BBTjyxErNYd4pRqfK4TcLeUXg',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2031',
    remoteAssetId: {
      type: 'ForeignAsset',
      value: 6,
    },
    remoteDecimals: 6,
    assetSymbol: 'USDC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 1337,
    reserveAddress: '13cKp89TtYknbyYnqnF6dWN75q5ZosvFSuqzoEVkUAaNR47A',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2030',
    remoteAssetId: {
      type: 'Token2',
      value: 5,
    },
    remoteDecimals: 6,
    assetSymbol: 'USDC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 1337,
    reserveAddress: '13cKp89P5dSS97HR8gme172QkfBaMDXK5rYHegYGH7m6yxhA',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2006',
    remoteAssetId: '4294969281',
    remoteDecimals: 6,
    assetSymbol: 'USDC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 1337,
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 22,
    remoteDecimals: 6,
    assetSymbol: 'USDC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 1337,
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFF7d2b0b761af01ca8e25242976ac0ad7d',
    remoteDecimals: 6,
    assetSymbol: 'USDC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 1984,
    reserveAddress: '13cKp89UHns9eDQQV3CZ1seFH6QQ6bnVeLHe4SpsekeJse1r',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2032',
    remoteAssetId: 2,
    remoteDecimals: 6,
    assetSymbol: 'USDt',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 1984,
    reserveAddress: '13cKp89U6Aoy86UbfQipph1BBTjyxErNYd4pRqfK4TcLeUXg',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2031',
    remoteAssetId: {
      type: 'ForeignAsset',
      value: 1,
    },
    remoteDecimals: 6,
    assetSymbol: 'USDt',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 1984,
    reserveAddress: '13cKp89TtYknbyYnqnF6dWN75q5ZosvFSuqzoEVkUAaNR47A',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2030',
    remoteAssetId: {
      type: 'Token2',
      value: 2,
    },
    remoteDecimals: 6,
    assetSymbol: 'USDt',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 1984,
    reserveAddress: '13cKp89P5dSS97HR8gme172QkfBaMDXK5rYHegYGH7m6yxhA',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2006',
    remoteAssetId: '4294969280',
    remoteDecimals: 6,
    assetSymbol: 'USDt',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 1984,
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFFea09fb06d082fd1275cd48b191cbcd1d',
    remoteDecimals: 6,
    assetSymbol: 'USDt',
  },
  {
    reserveChain: 'urn:ocn:polkadot:1000',
    reserveAssetId: 1984,
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 10,
    remoteDecimals: 6,
    assetSymbol: 'USDt',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: '0x06e605775296e851ff43b4daa541bb0984e9d6fd',
    reserveAddress: '0x7369626CF0070000000000000000000000000000',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2032',
    remoteAssetId: 4,
    remoteDecimals: 18,
    assetSymbol: 'DAI',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: '0x06e605775296e851ff43b4daa541bb0984e9d6fd',
    reserveAddress: '0x7369626cf2070000000000000000000000000000',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 18,
    remoteDecimals: 18,
    assetSymbol: 'DAI',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: '0x3f9610a50630bc7d4530736942ee2bc9e00e8de8',
    reserveAddress: '0x7369626cf2070000000000000000000000000000',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 44,
    remoteDecimals: 6,
    assetSymbol: 'EURC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: '0x484ecce6775143d3335ed2c7bcb22151c53b9f49',
    reserveAddress: '0x7369626cf2070000000000000000000000000000',
    reserveDecimals: 9,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000753,
    remoteDecimals: 9,
    assetSymbol: 'SUI',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: '0x52b2f622f5676e92dbea3092004eb9ffb85a8d07',
    reserveAddress: '0x7369626cf2070000000000000000000000000000',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 43,
    remoteDecimals: 6,
    assetSymbol: 'PRIME',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: '0x931715fee2d06333043d11f658c8ce934ac61d0c',
    reserveAddress: '0x7369626CF0070000000000000000000000000000',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2032',
    remoteAssetId: 8,
    remoteDecimals: 6,
    assetSymbol: 'USDC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: '0x931715fee2d06333043d11f658c8ce934ac61d0c',
    reserveAddress: '0x7369626cf2070000000000000000000000000000',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 21,
    remoteDecimals: 6,
    assetSymbol: 'USDC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: '0x99Fec54a5Ad36D50A4Bba3a41CAB983a5BB86A7d',
    reserveAddress: '0x7369626cf2070000000000000000000000000000',
    reserveDecimals: 9,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000752,
    remoteDecimals: 9,
    assetSymbol: 'SOL',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: '0xab3f0245B83feB11d15AAffeFD7AD465a59817eD',
    reserveAddress: '0x7369626CF0070000000000000000000000000000',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2032',
    remoteAssetId: 6,
    remoteDecimals: 18,
    assetSymbol: 'WETH',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: '0xab3f0245B83feB11d15AAffeFD7AD465a59817eD',
    reserveAddress: '0x7369626cf2070000000000000000000000000000',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 20,
    remoteDecimals: 18,
    assetSymbol: 'WETH',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: '0xbc7e02c4178a7df7d3e564323a5c359dc96c4db4',
    reserveAddress: '0x7369626CF0070000000000000000000000000000',
    reserveDecimals: 10,
    remoteChain: 'urn:ocn:polkadot:2032',
    remoteAssetId: 15,
    remoteDecimals: 10,
    assetSymbol: 'stDOT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: '0xc30E9cA94CF52f3Bf5692aaCF81353a27052c46f',
    reserveAddress: '0x7369626cf2070000000000000000000000000000',
    reserveDecimals: 6,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 23,
    remoteDecimals: 6,
    assetSymbol: 'USDT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: '0xda430218862d3db25de9f61458645dde49a9e9c1',
    reserveAddress: '0x7369626cf2070000000000000000000000000000',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000745,
    remoteDecimals: 18,
    assetSymbol: 'sUSDS',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: '0xE57eBd2d67B462E9926e04a8e33f01cD0D64346D',
    reserveAddress: '0x7369626CF0070000000000000000000000000000',
    reserveDecimals: 8,
    remoteChain: 'urn:ocn:polkadot:2032',
    remoteAssetId: 9,
    remoteDecimals: 8,
    assetSymbol: 'WBTC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: '0xE57eBd2d67B462E9926e04a8e33f01cD0D64346D',
    reserveAddress: '0x7369626cf2070000000000000000000000000000',
    reserveDecimals: 8,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 19,
    remoteDecimals: 8,
    assetSymbol: 'WBTC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: '0xe9f9a2e3deae4093c00fbc57b22bb51a4c05ad88',
    reserveAddress: '0x7369626cf2070000000000000000000000000000',
    reserveDecimals: 9,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 40,
    remoteDecimals: 9,
    assetSymbol: 'JitoSOL',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: 'native',
    reserveAddress: '0x7369626CF0070000000000000000000000000000',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2032',
    remoteAssetId: 10,
    remoteDecimals: 18,
    assetSymbol: 'GLMR',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: 'native',
    reserveAddress: '0x7369626cef070000000000000000000000000000',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2031',
    remoteAssetId: {
      type: 'ForeignAsset',
      value: 4,
    },
    remoteDecimals: 18,
    assetSymbol: 'GLMR',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: 'native',
    reserveAddress: '0x7369626cee070000000000000000000000000000',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2030',
    remoteAssetId: {
      type: 'Token2',
      value: 1,
    },
    remoteDecimals: 18,
    assetSymbol: 'GLMR',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: 'native',
    reserveAddress: '0x7369626CD6070000000000000000000000000000',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2006',
    remoteAssetId: '18446744073709551619',
    remoteDecimals: 18,
    assetSymbol: 'GLMR',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2004',
    reserveAssetId: 'native',
    reserveAddress: '0x7369626cf2070000000000000000000000000000',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 16,
    remoteDecimals: 18,
    assetSymbol: 'GLMR',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2006',
    reserveAssetId: 'native',
    reserveAddress: '13cKp89TtYknbyYnqnF6dWN75q5ZosvFSuqzoEVkUAaNR47A',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2030',
    remoteAssetId: {
      type: 'Token2',
      value: 3,
    },
    remoteDecimals: 18,
    assetSymbol: 'ASTR',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2006',
    reserveAssetId: 'native',
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 9,
    remoteDecimals: 18,
    assetSymbol: 'ASTR',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2006',
    reserveAssetId: 'native',
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFFa893ad19e540e172c10d78d4d479b5cf',
    remoteDecimals: 18,
    assetSymbol: 'ASTR',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'Native',
      value: {
        type: 'BNC',
      },
    },
    reserveAddress: '13cKp89UHns9eDQQV3CZ1seFH6QQ6bnVeLHe4SpsekeJse1r',
    reserveDecimals: 12,
    remoteChain: 'urn:ocn:polkadot:2032',
    remoteAssetId: 11,
    remoteDecimals: 12,
    assetSymbol: 'BNC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'Native',
      value: {
        type: 'BNC',
      },
    },
    reserveAddress: '13cKp89SgdtqUngo2WiEijPrQWdHFhzYZLf2TJePKRvExk7o',
    reserveDecimals: 12,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 1,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'Parachain',
            value: 2030,
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
    remoteDecimals: 12,
    assetSymbol: 'BNC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'Native',
      value: {
        type: 'BNC',
      },
    },
    reserveAddress: '13cKp89P5dSS97HR8gme172QkfBaMDXK5rYHegYGH7m6yxhA',
    reserveDecimals: 12,
    remoteChain: 'urn:ocn:polkadot:2006',
    remoteAssetId: '18446744073709551623',
    remoteDecimals: 12,
    assetSymbol: 'BNC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'Native',
      value: {
        type: 'BNC',
      },
    },
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 12,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFF7cc06abdf7201b350a1265c62c8601d2',
    remoteDecimals: 12,
    assetSymbol: 'BNC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'Native',
      value: {
        type: 'BNC',
      },
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 12,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 14,
    remoteDecimals: 12,
    assetSymbol: 'BNC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'Token2',
      value: 4,
    },
    reserveAddress: '13cKp89P5dSS97HR8gme172QkfBaMDXK5rYHegYGH7m6yxhA',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2006',
    remoteAssetId: '18446744073709551639',
    remoteDecimals: 18,
    assetSymbol: 'FIL',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'Token2',
      value: 4,
    },
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFF6c57e17d210df507c82807149ffd70b2',
    remoteDecimals: 18,
    assetSymbol: 'FIL',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'Token2',
      value: 9,
    },
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 12,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFF6af229ae7f0f4e0188157e189a487d59',
    remoteDecimals: 12,
    assetSymbol: 'BNCS',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'Token2',
      value: 9,
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 12,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 1000020,
    remoteDecimals: 12,
    assetSymbol: 'BNCS',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'VToken2',
      value: 0,
    },
    reserveAddress: '13cKp89UHns9eDQQV3CZ1seFH6QQ6bnVeLHe4SpsekeJse1r',
    reserveDecimals: 10,
    remoteChain: 'urn:ocn:polkadot:2032',
    remoteAssetId: 3,
    remoteDecimals: 10,
    assetSymbol: 'vDOT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'VToken2',
      value: 0,
    },
    reserveAddress: '13cKp89SgdtqUngo2WiEijPrQWdHFhzYZLf2TJePKRvExk7o',
    reserveDecimals: 10,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 1,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'Parachain',
            value: 2030,
          },
          {
            type: 'GeneralKey',
            value: {
              length: 2,
              data: '0x0900000000000000000000000000000000000000000000000000000000000000',
            },
          },
        ],
      },
    },
    remoteDecimals: 10,
    assetSymbol: 'vDOT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'VToken2',
      value: 0,
    },
    reserveAddress: '13cKp89P5dSS97HR8gme172QkfBaMDXK5rYHegYGH7m6yxhA',
    reserveDecimals: 10,
    remoteChain: 'urn:ocn:polkadot:2006',
    remoteAssetId: '18446744073709551624',
    remoteDecimals: 10,
    assetSymbol: 'vDOT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'VToken2',
      value: 0,
    },
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 10,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFF15e1b7e3df971dd813bc394deb899abf',
    remoteDecimals: 10,
    assetSymbol: 'vDOT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'VToken2',
      value: 0,
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 10,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 15,
    remoteDecimals: 10,
    assetSymbol: 'vDOT',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'VToken2',
      value: 1,
    },
    reserveAddress: '13cKp89P5dSS97HR8gme172QkfBaMDXK5rYHegYGH7m6yxhA',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2006',
    remoteAssetId: '18446744073709551637',
    remoteDecimals: 18,
    assetSymbol: 'vGLMR',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'VToken2',
      value: 1,
    },
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFF99dabe1a8de0ea22baa6fd48fde96f6c',
    remoteDecimals: 18,
    assetSymbol: 'vGLMR',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'VToken2',
      value: 3,
    },
    reserveAddress: '13cKp89P5dSS97HR8gme172QkfBaMDXK5rYHegYGH7m6yxhA',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2006',
    remoteAssetId: '18446744073709551632',
    remoteDecimals: 18,
    assetSymbol: 'vASTR',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'VToken2',
      value: 3,
    },
    reserveAddress: '13cKp89Uh2yWgTG28JA1QEvPUMjEPKejqkjHKf9zqLiFKjH6',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2034',
    remoteAssetId: 33,
    remoteDecimals: 18,
    assetSymbol: 'vASTR',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'VToken2',
      value: 3,
    },
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFF55c732c47639231a4c4373245763d26e',
    remoteDecimals: 18,
    assetSymbol: 'vASTR',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'VToken2',
      value: 4,
    },
    reserveAddress: '13cKp89P5dSS97HR8gme172QkfBaMDXK5rYHegYGH7m6yxhA',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2006',
    remoteAssetId: '18446744073709551640',
    remoteDecimals: 18,
    assetSymbol: 'vFIL',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'VToken2',
      value: 4,
    },
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFFcd0ad0ea6576b7b285295c85e94cf4c1',
    remoteDecimals: 18,
    assetSymbol: 'vFIL',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'VToken2',
      value: 8,
    },
    reserveAddress: '13cKp89P5dSS97HR8gme172QkfBaMDXK5rYHegYGH7m6yxhA',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2006',
    remoteAssetId: '18446744073709551638',
    remoteDecimals: 18,
    assetSymbol: 'vMANTA',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'VToken2',
      value: 8,
    },
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 18,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFFda2a05fb50e7ae99275f4341aed43379',
    remoteDecimals: 18,
    assetSymbol: 'vMANTA',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2030',
    reserveAssetId: {
      type: 'VToken',
      value: {
        type: 'BNC',
      },
    },
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 12,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFF31d724194b6a76e1d639c8787e16796b',
    remoteDecimals: 12,
    assetSymbol: 'vBNC',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2034',
    reserveAssetId: 0,
    reserveAddress: '13cKp89UHns9eDQQV3CZ1seFH6QQ6bnVeLHe4SpsekeJse1r',
    reserveDecimals: 12,
    remoteChain: 'urn:ocn:polkadot:2032',
    remoteAssetId: 13,
    remoteDecimals: 12,
    assetSymbol: 'HDX',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2034',
    reserveAssetId: 0,
    reserveAddress: '13cKp89SgdtqUngo2WiEijPrQWdHFhzYZLf2TJePKRvExk7o',
    reserveDecimals: 12,
    remoteChain: 'urn:ocn:polkadot:1000',
    remoteAssetId: {
      parents: 1,
      interior: {
        type: 'X2',
        value: [
          {
            type: 'Parachain',
            value: 2034,
          },
          {
            type: 'GeneralIndex',
            value: '0',
          },
        ],
      },
    },
    remoteDecimals: 12,
    assetSymbol: 'HDX',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2034',
    reserveAssetId: 0,
    reserveAddress: '13cKp89P5dSS97HR8gme172QkfBaMDXK5rYHegYGH7m6yxhA',
    reserveDecimals: 12,
    remoteChain: 'urn:ocn:polkadot:2006',
    remoteAssetId: '18446744073709551630',
    remoteDecimals: 12,
    assetSymbol: 'HDX',
  },
  {
    reserveChain: 'urn:ocn:polkadot:2034',
    reserveAssetId: 0,
    reserveAddress: '13cKp89NgPL56sRoVRpBcjkGZPrk4Vf4tS6ePUD96XhAXozG',
    reserveDecimals: 12,
    remoteChain: 'urn:ocn:polkadot:2004',
    remoteAssetId: '0xFFFFFFFF345dc44ddae98df024eb494321e73fcc',
    remoteDecimals: 12,
    assetSymbol: 'HDX',
  },
]

export function createIssuanceInputsMap(): Map<string, CrosschainIssuanceInputs[]> {
  return issuanceInputs.reduce((map, item) => {
    const key = `${item.reserveChain}-${item.remoteChain}`

    const existing = map.get(key)
    if (existing) {
      existing.push(item)
    } else {
      map.set(key, [item])
    }

    return map
  }, new Map<string, CrosschainIssuanceInputs[]>())
}
