import { AssetIdentifier } from './types.js'

export const tickerToAssetIdMap: Record<string, AssetIdentifier | AssetIdentifier[]> = {
  DAI: [
    {
      chainId: 'urn:ocn:ethereum:1',
      assetId: '0x6b175474e89094c44da98b954eedeac495271d0f',
    },
    {
      chainId: 'urn:ocn:polkadot:2004',
      assetId: '0x06e605775296e851ff43b4daa541bb0984e9d6fd',
    },
  ],
  DOT: [
    {
      chainId: 'urn:ocn:polkadot:0',
      assetId: 'native',
    },
    {
      chainId: 'urn:ocn:polkadot:3367',
      assetId: '0x9bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f',
    },
  ],
  ETH: [
    {
      chainId: 'urn:ocn:ethereum:1',
      assetId: 'native',
    },
    {
      chainId: 'urn:ocn:polkadot:3367',
      assetId: '0x7aa111f84bbd868d8fd55867959aa78bce6bcddabb2f5d14580fd232d94f4949', // arb_ETH
    },
    {
      chainId: 'urn:ocn:polkadot:3367',
      assetId: '0x9d73bf7de387b25f0aff297e40734d86f04fc00110134e7b3399c968c2d4af75', // op_ETH
    },
    {
      chainId: 'urn:ocn:polkadot:3367',
      assetId: '0xaaaebeba3810b1e6b70781f14b2d72c1cb89c0b2b320c43bb67ff79f562f5ff4', // hyperbridge_ETH
    },
    {
      chainId: 'urn:ocn:polkadot:3367',
      assetId: '0xcb9a8249a8fa29a9255d9e5cd657c363eb0aaa03b5ec67887a74423fbb78c3ff', // base_ETH
    },
  ],
  WBTC: [
    {
      chainId: 'urn:ocn:ethereum:1',
      assetId: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    },
    {
      chainId: 'urn:ocn:polkadot:2004',
      assetId: '0xE57eBd2d67B462E9926e04a8e33f01cD0D64346D',
    },
  ],
  WETH: [
    {
      chainId: 'urn:ocn:ethereum:1',
      assetId: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    },
    {
      chainId: 'urn:ocn:polkadot:2004',
      assetId: '0xab3f0245B83feB11d15AAffeFD7AD465a59817eD',
    },
  ],
  WSTETH: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
  },
  TBTC: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: '0x18084fba666a33d37592fa2633fd49a74dd93a88',
  },
  LINK: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: '0x514910771af9ca656af840dff83e8264ecf986ca',
  },
  SKY: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: '0x56072c95faa701256059aa122697b133aded9279',
  },
  LDO: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: '0x5a98fcbea516cf06857215779fd812ca3bef1b32',
  },
  AAVE: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  },
  LBTC: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: '0x8236a87084f8b84306f72007f36f2618a5634494',
  },
  TRAC: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: '0xaa7a9ca87d3694b5755f213b5d04094b8d0f0a6f',
  },
  'CGT2.0': {
    chainId: 'urn:ocn:ethereum:1',
    assetId: '0x0e186357c323c806c1efdad36d217f7a54b63d18',
  },
  XRT: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: '0x7de91b204c1c737bcee6f000aaa6569cf7061cb7',
  },
  GLMR: [
    {
      chainId: 'urn:ocn:polkadot:2004',
      assetId: 'native',
    },
    {
      chainId: 'urn:ocn:polkadot:3367',
      assetId: '0xa4690066220620100ea0109a1e46cbd5096ab757e3117d17b6ee1b6f27fe420c',
    },
  ],
  ASTR: [
    {
      chainId: 'urn:ocn:polkadot:2006',
      assetId: 'native',
    },
    {
      chainId: 'urn:ocn:polkadot:3367',
      assetId: '0xef9c12300328f9f458b10811de24a7dd12738a28e9312f700a64c2afc0699f06',
    },
  ],
  ACA: [
    {
      chainId: 'urn:ocn:polkadot:2000',
      assetId: 'native',
    },
    {
      chainId: 'urn:ocn:polkadot:2000',
      assetId: {
        type: 'NativeAssetId',
        value: {
          type: 'Token',
          value: {
            type: 'ACA',
          },
        },
      },
    },
  ],
  BNC: [
    {
      chainId: 'urn:ocn:polkadot:2030',
      assetId: 'native',
    },
    {
      chainId: 'urn:ocn:polkadot:2030',
      assetId: 'native:BNC',
    },
    {
      chainId: 'urn:ocn:polkadot:3367',
      assetId: '0x2a4161abff7b056457562a2e82dd6f5878159be2537b90f19dd1458b40524d3f',
    },
  ],
  HDX: [
    {
      chainId: 'urn:ocn:polkadot:2034',
      assetId: 'native',
    },
    {
      chainId: 'urn:ocn:polkadot:2034',
      assetId: 0,
    },
  ],
  MYTH: [
    {
      chainId: 'urn:ocn:polkadot:3369',
      assetId: 'native',
    },
    {
      chainId: 'urn:ocn:ethereum:1',
      assetId: '0xba41ddf06b7ffd89d1267b5a93bfef2424eb2003',
    },
  ],
  CFG: {
    chainId: 'urn:ocn:polkadot:2031',
    assetId: 'native',
  },
  PHA: {
    chainId: 'urn:ocn:polkadot:2035',
    assetId: 'native',
  },
  USDT: [
    {
      chainId: 'urn:ocn:polkadot:1000',
      assetId: '1984',
    },
    {
      chainId: 'urn:ocn:polkadot:2004',
      assetId: '0xc30E9cA94CF52f3Bf5692aaCF81353a27052c46f',
    },
    {
      chainId: 'urn:ocn:ethereum:1',
      assetId: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    },
  ],
  USDC: [
    {
      chainId: 'urn:ocn:polkadot:1000',
      assetId: '1337',
    },
    {
      chainId: 'urn:ocn:polkadot:2004',
      assetId: '0x931715fee2d06333043d11f658c8ce934ac61d0c',
    },
    {
      chainId: 'urn:ocn:ethereum:1',
      assetId: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    },
  ],
  SOL: [
    {
      chainId: 'urn:ocn:polkadot:2004',
      assetId: '0x99fec54a5ad36d50a4bba3a41cab983a5bb86a7d',
    },
  ],
  VDOT: [
    {
      chainId: 'urn:ocn:polkadot:2030',
      assetId: {
        type: 'VToken2',
        value: 0,
      },
    },
    {
      chainId: 'urn:ocn:polkadot:3367',
      assetId: '0x2c39e61e26a9f54b13049db72ed462371c4675161ad800538eefbb25e5f5531f',
    },
  ],
  VASTR: [
    {
      chainId: 'urn:ocn:polkadot:2030',
      assetId: {
        type: 'VToken2',
        value: 3,
      },
    },
    {
      chainId: 'urn:ocn:polkadot:3367',
      assetId: '0x2d66857ceb4c6311bb5abfeddfe4624860174e9da405e339418afe4c5070115d',
    },
  ],
  VGLMR: [
    {
      chainId: 'urn:ocn:polkadot:2030',
      assetId: {
        type: 'VToken2',
        value: 1,
      },
    },
    {
      chainId: 'urn:ocn:polkadot:3367',
      assetId: '0xe54767e847e8018d70039d42ce516c616bb93946432cd6adc3575711147640c9',
    },
  ],
  VMANTA: [
    {
      chainId: 'urn:ocn:polkadot:2030',
      assetId: {
        type: 'VToken2',
        value: 8,
      },
    },
    {
      chainId: 'urn:ocn:polkadot:3367',
      assetId: '0x1a9e68a6835e2c9845787b1ee5ee9a7fbe012c9eb01aee28081be1a756032de4',
    },
  ],
  MANTA: [
    {
      chainId: 'urn:ocn:polkadot:2104',
      assetId: 'native',
    },
    {
      chainId: 'urn:ocn:polkadot:3367',
      assetId: '0x9ea858a814b69366a6cec8e38eccc8c62cf4b8f1254b7b1674a9c660acf57108',
    },
  ],
  KSM: {
    chainId: 'urn:ocn:kusama:0',
    assetId: 'native',
  },
  IBTC: {
    chainId: 'urn:ocn:polkadot:2032',
    assetId: 'native:IBTC',
  },
  INTR: {
    chainId: 'urn:ocn:polkadot:2032',
    assetId: 'native',
  },
  KILT: [
    {
      chainId: 'urn:ocn:polkadot:2086',
      assetId: 'native',
    },
    {
      chainId: 'urn:ocn:ethereum:1',
      assetId: '0x5d3d01fd6d2ad1169b17918eb4f153c6616288eb',
    },
    {
      chainId: 'urn:ocn:polkadot:3367',
      assetId: '0x8a5bd076c25a6e50fb27e8981c475bba121b88de63212d301e664ddb32c40a52',
    },
    {
      chainId: 'urn:ocn:polkadot:3367',
      assetId: '0xc13f49c92370ffbe792a617224ba7ed9a13924d30e8be23084f946feb7700a64',
    },
  ],
  UNQ: {
    chainId: 'urn:ocn:polkadot:2037',
    assetId: 'native',
  },
  SUI: {
    chainId: 'urn:ocn:polkadot:2004',
    assetId: '0x484ecce6775143d3335ed2c7bcb22151c53b9f49',
  },
  PAXG: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: '0x45804880de22913dafe09f4980848ece6ecbaf78',
  },
  ENA: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: '0x57e114b691db790c35207b2e685d4a43181e6061',
  },
  TEER: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: '0x769916a66fdac0e3d57363129caac59386ea622b',
  },
  SUSDE: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: '0x9d39a5de30e57443bff2a8307a4256c8797a3497',
  },
  EURC: [
    {
      chainId: 'urn:ocn:ethereum:1',
      assetId: '0x1abaea1f7c830bd89acc67ec4af516284b1bc33c',
    },
    {
      chainId: 'urn:ocn:polkadot:2034',
      assetId: 42,
    },
    {
      chainId: 'urn:ocn:polkadot:3367',
      assetId: '0x147758d3dafb1e8675e1a8ecff01cc8a943115b0fec1f4a13cfd4b303e47244a',
    },
    {
      chainId: 'urn:ocn:ethereum:8453',
      assetId: '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42',
    },
    {
      chainId: 'urn:ocn:polkadot:2004',
      assetId: '0x3f9610a50630bc7d4530736942ee2bc9e00e8de8',
    },
  ],
  jitoSOL: [
    { chainId: 'urn:ocn:solana:101', assetId: 'j1toso1uck3rlmjorhttrvwy9hj7x8v9yyac6y7kgcpn' },
    {
      chainId: 'urn:ocn:polkadot:2004',
      assetId: '0xe9f9a2e3deae4093c00fbc57b22bb51a4c05ad88',
    },
  ],
  sUSDS: [
    {
      chainId: 'urn:ocn:polkadot:2004',
      assetId: '0xda430218862d3db25de9f61458645dde49a9e9c1',
    },
    {
      chainId: 'urn:ocn:ethereum:1',
      assetId: '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd',
    },
  ],
  PRIME: [
    {
      chainId: 'urn:ocn:polkadot:2004',
      assetId: '0x52b2f622f5676e92dbea3092004eb9ffb85a8d07',
    },
    {
      chainId: 'urn:ocn:solana:101',
      assetId: '3b8x44flf9ooxaum3hhsgjpmvs6rzz3ppogngahc3uu7',
    },
  ],
}
