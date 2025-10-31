type TokenInfo = {
  symbol: string
  decimals: number
  isNative?: boolean
}

const TOKEN_REGISTRY: Record<string, TokenInfo> = {
  ['1:so11111111111111111111111111111111111111112']: {
    symbol: 'WSOL',
    decimals: 9,
    isNative: false,
  },
  ['1:epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwydt1v']: {
    symbol: 'USDC',
    decimals: 6,
    isNative: false,
  },
  ['1:j1toso1uck3rlmjorhttrvwy9hj7x8v9yyac6y7kgcpn']: {
    symbol: 'JitoSOL',
    decimals: 9,
    isNative: false,
  },
  ['16:0xacc15dc74880c9944775448304b263d191c6077f']: {
    symbol: 'WGLMR',
    decimals: 18,
    isNative: false,
  },
  ['16:0x511ab53f793683763e5a8829738301368a2411e3']: {
    symbol: 'WELL',
    decimals: 18,
    isNative: false,
  },
  ['16:0x3405a1bd46b85c5c029483fbecf2f3e611026e45']: {
    symbol: 'MATIC',
    decimals: 18,
    isNative: false,
  },
  ['21:0x9258181f5ceac8dbffb7030890243caed69a9599d2886d957a9cb7656af3bdb3']: {
    symbol: 'WSUI',
    decimals: 9,
    isNative: false,
  },
  ['2:0xa3931d71877c0e7a3148cb7eb4463524fec27fbd']: {
    symbol: 'sUSDS',
    decimals: 18,
    isNative: false,
  },
  ['2:0xdac17f958d2ee523a2206206994597c13d831ec7']: {
    symbol: 'USDT',
    decimals: 6,
    isNative: false,
  },
  ['2:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2']: {
    symbol: 'WETH',
    decimals: 18,
    isNative: false,
  },
  ['2:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599']: {
    symbol: 'WBTC',
    decimals: 8,
    isNative: false,
  },
  ['2:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48']: {
    symbol: 'USDC',
    decimals: 6,
    isNative: false,
  },
  ['2:0x6b175474e89094c44da98b954eedeac495271d0f']: {
    symbol: 'DAI',
    decimals: 18,
    isNative: false,
  },
  ['4:0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c']: {
    symbol: 'WBNB',
    decimals: 18,
    isNative: true,
  },
  ['30:0xa88594d404727625a9437c3f886c7643872296ae']: {
    symbol: 'WELL',
    decimals: 18,
    isNative: false,
  },
  ['30:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913']: {
    symbol: 'USDC',
    decimals: 6,
    isNative: false,
  },
  ['6:0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7']: {
    symbol: 'WAVAX',
    decimals: 18,
    isNative: false,
  },
}

export const tokenRegistry = {
  lookup: (chain: string | number, address: string): TokenInfo | undefined => {
    return TOKEN_REGISTRY[`${chain}:${address.toLowerCase()}`]
  },
}
