import { Chain, defineChain } from 'viem'

export const customChains: Record<string, Chain> = {
  'urn:ocn:ethereum:222222': defineChain({
    id: 222222,
    name: 'Hydration',
    network: 'hydration',
    nativeCurrency: {
      decimals: 18,
      name: 'WETH',
      symbol: 'WETH',
    },
    rpcUrls: {
      public: {
        http: ['https://hydration.ibp.network'],
        webSocket: ['wss://hydration.ibp.network'],
      },
      default: {
        http: ['https://hydration.ibp.network'],
        webSocket: ['wss://hydration.ibp.network'],
      },
    },
    testnet: false,
  }),
}
