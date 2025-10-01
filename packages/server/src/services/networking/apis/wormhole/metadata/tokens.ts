type TokenInfo = {
  chainName: string // used for urn: ocn:<chainName>:<chainId>|...
  symbol: string
  decimals: number
  treatAsNative?: boolean // true if this token represents the chain native coin
}

const TOKEN_REGISTRY: Record<string, TokenInfo> = {
  ['1:so11111111111111111111111111111111111111112']: {
    chainName: 'solana',
    symbol: 'SOL',
    decimals: 9,
    treatAsNative: true,
  },
  ['21:0x9258181f5ceac8dbffb7030890243caed69a9599d2886d957a9cb7656af3bdb3']: {
    chainName: 'sui',
    symbol: 'SUI',
    decimals: 9,
    treatAsNative: true,
  },
  ['2:0xdac17f958d2ee523a2206206994597c13d831ec7']: {
    chainName: 'ethereum',
    symbol: 'USDT',
    decimals: 6,
    treatAsNative: false,
  },
  ['2:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2']: {
    chainName: 'ethereum',
    symbol: 'WETH',
    decimals: 18,
    treatAsNative: false,
  },
  ['30:0xa88594d404727625a9437c3f886c7643872296ae']: {
    chainName: 'base',
    symbol: 'WELL',
    decimals: 18,
    treatAsNative: false,
  },
}

export const tokenRegistry = {
  lookup: (chain: string | number, address: string): TokenInfo | undefined => {
    return TOKEN_REGISTRY[`${chain}:${address.toLowerCase()}`]
  },
}
