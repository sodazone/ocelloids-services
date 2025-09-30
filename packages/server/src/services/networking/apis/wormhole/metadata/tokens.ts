type TokenInfo = {
  chainName: string // used for urn: ocn:<chainName>:<chainId>|...
  symbol: string
  decimals: number
  treatAsNative?: boolean // true if this token represents the chain native coin
}

export const TOKEN_REGISTRY: Record<string, TokenInfo> = {
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

  // Ethereum native (we typically treat native via no token address; but include if needed)
  // For ERC-20 representations you'd put the 0x... address here with chainName 'ethereum'
  // e.g. ['1:0xa0b86991...']: { chainName: 'ethereum', symbol: 'USDC', decimals: 6 }
}
