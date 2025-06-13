import { AssetIdentifier } from './types.js'

export const tickerToAssetIdMap: Record<string, AssetIdentifier | AssetIdentifier[]> = {
  DOT: {
    chainId: 'urn:ocn:polkadot:0',
    assetId: 'native',
  },
  ETH: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: 'native',
  },
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
  LIDO: {
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
  GLMR: {
    chainId: 'urn:ocn:polkadot:2004',
    assetId: 'native',
  },
  ASTR: {
    chainId: 'urn:ocn:polkadot:2006',
    assetId: 'native',
  },
  ACA: {
    chainId: 'urn:ocn:polkadot:2000',
    assetId: 'native',
  },
  BNC: [
    {
      chainId: 'urn:ocn:polkadot:2030',
      assetId: 'native',
    },
    {
      chainId: 'urn:ocn:polkadot:2030',
      assetId: 'native:BNC',
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
  VDOT: {
    chainId: 'urn:ocn:polkadot:2030',
    assetId: {
      type: 'VToken2',
      value: 0,
    },
  },
  VASTR: {
    chainId: 'urn:ocn:polkadot:2030',
    assetId: {
      type: 'VToken2',
      value: 3,
    },
  },
  VGLMR: {
    chainId: 'urn:ocn:polkadot:2030',
    assetId: {
      type: 'VToken2',
      value: 1,
    },
  },
  VMANTA: {
    chainId: 'urn:ocn:polkadot:2030',
    assetId: {
      type: 'VToken2',
      value: 8,
    },
  },
  KSM: {
    chainId: 'urn:ocn:kusama:0',
    assetId: 'native',
  },
}
