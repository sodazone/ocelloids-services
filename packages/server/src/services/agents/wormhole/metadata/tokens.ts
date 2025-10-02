type TokenInfo = {
  symbol: string
  decimals: number
  isNative?: boolean
}

const TOKEN_REGISTRY: Record<string, TokenInfo> = {
  ['1:so11111111111111111111111111111111111111112']: {
    symbol: 'SOL',
    decimals: 9,
    isNative: true,
  },
  ['21:0x9258181f5ceac8dbffb7030890243caed69a9599d2886d957a9cb7656af3bdb3']: {
    symbol: 'SUI',
    decimals: 9,
    isNative: true,
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
  ['30:0xa88594d404727625a9437c3f886c7643872296ae']: {
    symbol: 'WELL',
    decimals: 18,
    isNative: false,
  },
}

export const tokenRegistry = {
  lookup: (chain: string | number, address: string): TokenInfo | undefined => {
    return TOKEN_REGISTRY[`${chain}:${address.toLowerCase()}`]
  },
}
