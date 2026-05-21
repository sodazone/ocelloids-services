import { zeroAddress } from 'viem'
import { HexString } from '@/lib.js'
import { Token } from '../../../protocols/moonwell/types.js'

const contracts: Record<string, HexString> = {
  comptroller: '0x8e00d5e02e65a19337cdba98bba9f84d4186a180',
  oracle: '0xED301cd3EB27217BDB05C4E9B820a8A3c8B665f9',
}

const markets = {
  MOONWELL_GLMR: {
    marketToken: 'MOONWELL_GLMR',
    underlyingToken: 'GLMR',
  },
  MOONWELL_xcDOT: {
    marketToken: 'MOONWELL_xcDOT',
    underlyingToken: 'xcDOT',
    badDebt: true,
  },
  MOONWELL_FRAX: {
    marketToken: 'MOONWELL_FRAX',
    underlyingToken: 'FRAX',
    badDebt: true,
  },
  MOONWELL_xcUSDC: {
    marketToken: 'MOONWELL_xcUSDC',
    underlyingToken: 'xcUSDC',
  },
  MOONWELL_xcUSDT: {
    marketToken: 'MOONWELL_xcUSDT',
    underlyingToken: 'xcUSDT',
  },
  MOONWELL_ETH_NOMAD: {
    marketToken: 'MOONWELL_ETH_NOMAD',
    underlyingToken: 'ETH_NOMAD',
    deprecated: true,
  },
  MOONWELL_BTC_NOMAD: {
    marketToken: 'MOONWELL_BTC_NOMAD',
    underlyingToken: 'BTC_NOMAD',
    deprecated: true,
  },
  MOONWELL_USDC_NOMAD: {
    marketToken: 'MOONWELL_USDC_NOMAD',
    underlyingToken: 'USDC_NOMAD',
    deprecated: true,
  },
  MOONWELL_ETH_WORMHOLE: {
    marketToken: 'MOONWELL_ETH_WORMHOLE',
    underlyingToken: 'ETH_WORMHOLE',
  },
  MOONWELL_BTC_WORMHOLE: {
    marketToken: 'MOONWELL_BTC_WORMHOLE',
    underlyingToken: 'BTC_WORMHOLE',
  },
  MOONWELL_USDC_WORMHOLE: {
    marketToken: 'MOONWELL_USDC_WORMHOLE',
    underlyingToken: 'USDC_WORMHOLE',
  },
  MOONWELL_BUSD_WORMHOLE: {
    marketToken: 'MOONWELL_BUSD_WORMHOLE',
    underlyingToken: 'BUSD_WORMHOLE',
    deprecated: true,
  },
}

const tokens: Record<string, Token> = {
  GLMR: {
    address: zeroAddress,
    decimals: 18,
    name: 'Moonbeam',
    symbol: 'GLMR',
  },
  WGLMR: {
    address: '0xAcc15dC74880C9944775448304B263D191c6077F',
    decimals: 18,
    name: 'Wrapped GLMR',
    symbol: 'WGLMR',
  },
  MOONWELL_GLMR: {
    address: '0x091608f4e4a15335145be0A279483C0f8E4c7955',
    decimals: 8,
    name: 'Moonwell GLMR',
    symbol: 'mGLMR',
  },
  xcDOT: {
    address: '0xffffffff1fcacbd218edc0eba20fc2308c778080',
    decimals: 10,
    name: 'Polkadot',
    symbol: 'xcDOT',
  },
  MOONWELL_xcDOT: {
    address: '0xD22Da948c0aB3A27f5570b604f3ADef5F68211C3',
    decimals: 8,
    name: 'Moonwell xcDOT',
    symbol: 'mDOT',
  },
  FRAX: {
    address: '0x322e86852e492a7ee17f28a78c663da38fb33bfb',
    decimals: 18,
    name: 'Frax',
    symbol: 'FRAX',
  },
  MOONWELL_FRAX: {
    address: '0x1C55649f73CDA2f72CEf3DD6C5CA3d49EFcF484C',
    decimals: 8,
    name: 'Moonwell FRAX',
    symbol: 'mFRAX',
  },
  xcUSDC: {
    address: '0xFFfffffF7D2B0B761Af01Ca8e25242976ac0aD7D',
    decimals: 6,
    name: 'USD Coin',
    symbol: 'xcUSDC',
  },
  MOONWELL_xcUSDC: {
    address: '0x22b1a40e3178fe7C7109eFCc247C5bB2B34ABe32',
    decimals: 8,
    name: 'Moonwell xcUSDC',
    symbol: 'mxcUSDC',
  },
  xcUSDT: {
    address: '0xFFFFFFfFea09FB06d082fd1275CD48b191cbCD1d',
    decimals: 6,
    name: 'Tether',
    symbol: 'xcUSDT',
  },
  MOONWELL_xcUSDT: {
    address: '0x42A96C0681B74838eC525AdbD13c37f66388f289',
    decimals: 8,
    name: 'Moonwell xcUSDT',
    symbol: 'mxcUSDT',
  },
  ETH_NOMAD: {
    address: '0x30d2a9f5fdf90ace8c17952cbb4ee48a55d916a7',
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH.mad',
  },
  MOONWELL_ETH_NOMAD: {
    address: '0xc3090f41Eb54A7f18587FD6651d4D3ab477b07a4',
    decimals: 8,
    name: 'Moonwell ETH',
    symbol: 'mETH',
  },
  BTC_NOMAD: {
    address: '0x1DC78Acda13a8BC4408B207c9E48CDBc096D95e0',
    decimals: 8,
    name: 'Bitcoin',
    symbol: 'BTC.mad',
  },
  MOONWELL_BTC_NOMAD: {
    address: '0x24A9d8f1f350d59cB0368D3d52A77dB29c833D1D',
    decimals: 8,
    name: 'Moonwell BTC',
    symbol: 'mWBTC',
  },
  USDC_NOMAD: {
    address: '0x8f552a71efe5eefc207bf75485b356a0b3f01ec9',
    decimals: 6,
    name: 'USD Coin',
    symbol: 'USDC.mad',
  },
  MOONWELL_USDC_NOMAD: {
    address: '0x02e9081DfadD37A852F9a73C4d7d69e615E61334',
    decimals: 8,
    name: 'Moonwell USDC',
    symbol: 'mUSDC',
  },
  ETH_WORMHOLE: {
    address: '0xab3f0245b83feb11d15aaffefd7ad465a59817ed',
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH.wh',
  },
  MOONWELL_ETH_WORMHOLE: {
    address: '0xb6c94b3A378537300387B57ab1cC0d2083f9AeaC',
    decimals: 8,
    name: 'Moonwell ETH',
    symbol: 'mETH.wh',
  },
  BTC_WORMHOLE: {
    address: '0xe57ebd2d67b462e9926e04a8e33f01cd0d64346d',
    decimals: 8,
    name: 'Bitcoin',
    symbol: 'BTC.wh',
  },
  MOONWELL_BTC_WORMHOLE: {
    address: '0xaaa20c5a584a9fECdFEDD71E46DA7858B774A9ce',
    decimals: 8,
    name: 'Moonwell BTC',
    symbol: 'mWBTC.wh',
  },
  USDC_WORMHOLE: {
    address: '0x931715fee2d06333043d11f658c8ce934ac61d0c',
    decimals: 6,
    name: 'USD Coin',
    symbol: 'USDC.wh',
  },
  MOONWELL_USDC_WORMHOLE: {
    address: '0x744b1756e7651c6D57f5311767EAFE5E931D615b',
    decimals: 8,
    name: 'Moonwell USDC',
    symbol: 'mUSDC.wh',
  },
  BUSD_WORMHOLE: {
    address: '0x692c57641fc054c2ad6551ccc6566eba599de1ba',
    decimals: 18,
    name: 'BUSD Coin',
    symbol: 'BUSD.wh',
  },
  MOONWELL_BUSD_WORMHOLE: {
    address: '0x298f2E346b82D69a473BF25f329BDF869e17dEc8',
    decimals: 8,
    name: 'Moonwell BUSD',
    symbol: 'mBUSD.wh',
  },
  WELL: {
    address: '0x511aB53F793683763E5a8829738301368a2411E3',
    decimals: 18,
    name: 'WELL',
    symbol: 'WELL',
  },
  XWELL: {
    address: '0xA88594D404727625A9437C3f886C7643872296AE',
    decimals: 18,
    name: 'WELL',
    symbol: 'WELL',
  },
  stkWELL: {
    address: '0x8568A675384d761f36eC269D695d6Ce4423cfaB1',
    decimals: 18,
    name: 'stkWELL',
    symbol: 'stkWELL',
  },
}

export const defs = {
  markets,
  tokens,
  contracts,
}
