export const substrateNetworks: Record<string, string> = {
  polkadot: 'wss://rpc.ibp.network/polkadot',
  assethub: 'wss://polkadot-asset-hub-rpc.polkadot.io',
  bridgehub: 'wss://sys.ibp.network/bridgehub-polkadot',
  hydra: 'wss://hydradx.paras.ibp.network',
  moonbeam: 'wss://moonbeam.ibp.network',
  astar: 'wss://rpc.astar.network',
  bifrost: 'wss://bifrost-polkadot.ibp.network',
  interlay: 'wss://api.interlay.io/parachain',
  acala: 'wss://acala-rpc.dwellir.com',
  mythos: 'wss://mythos.ibp.network',
  nexus: 'wss://nexus.ibp.network',
  kassethub: 'wss://sys.ibp.network/asset-hub-kusama',
  kbridgehub: 'wss://sys.ibp.network/bridgehub-kusama',
  passethub: 'wss://sys.ibp.network/asset-hub-paseo',
}

export const evmNetworks: Record<string, { url: string; networkId: string }> = {
  ethereum: { url: 'https://eth.llamarpc.com', networkId: 'urn:ocn:ethereum:1' },
  polygon: { url: 'https://polygon-rpc.com/', networkId: 'urn:ocn:ethereum:137' },
  bsc: { url: 'https://binance.llamarpc.com', networkId: 'urn:ocn:ethereum:56' },
  arbitrum: { url: 'https://arbitrum-one-public.nodies.app', networkId: 'urn:ocn:ethereum:42161' },
}
