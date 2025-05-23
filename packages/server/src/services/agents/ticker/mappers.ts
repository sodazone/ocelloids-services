import { AssetIdentifier } from './types.js'

export const tickerToAssetIdMap: Record<string, AssetIdentifier> = {
  DOT: {
    chainId: 'urn:ocn:polkadot:0',
    assetId: 'native',
  },
  ETH: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: 'native',
  },
  WETH: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },
  WBTC: {
    chainId: 'urn:ocn:ethereum:1',
    assetId: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
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
  BNC: {
    chainId: 'urn:ocn:polkadot:2030',
    assetId: 'native',
  },
  HDX: {
    chainId: 'urn:ocn:polkadot:2034',
    assetId: 'native',
  },
  MYTH: {
    chainId: 'urn:ocn:polkadot:3369',
    assetId: 'native',
  },
  CFG: {
    chainId: 'urn:ocn:polkadot:2031',
    assetId: 'native',
  },
  PHA: {
    chainId: 'urn:ocn:polkadot:2035',
    assetId: 'native',
  },
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
  KSM: {
    chainId: 'urn:ocn:kusama:0',
    assetId: 'native',
  },
}
