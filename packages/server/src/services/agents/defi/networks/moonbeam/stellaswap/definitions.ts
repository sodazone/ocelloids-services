// TODO: util to load the pools and token info from chain
export const tokens: Record<string, { address: `0x${string}`; decimals: number }> = {
  xcDOT: {
    address: '0xffffffff1fcacbd218edc0eba20fc2308c778080',
    decimals: 10,
  },
  WGLMR: {
    address: '0xacc15dc74880c9944775448304b263d191c6077f',
    decimals: 18,
  },
  WETH: {
    address: '0xab3f0245B83feB11d15AAffeFD7AD465a59817eD',
    decimals: 18,
  },
  xcUSDC: {
    address: '0xffffffff7d2b0b761af01ca8e25242976ac0ad7d',
    decimals: 6,
  },
  xcUSDT: {
    address: '0xffffffffea09fb06d082fd1275cd48b191cbcd1d',
    decimals: 6,
  },
  'xcWBTC.e': {
    address: '0xffffffff1b4bb1ac5749f73d866ffc91a3432c47',
    decimals: 8,
  },
  'ETH.e': {
    address: '0xffffffffaff6df83d0a1935dda2e5f1f402c0c45',
    decimals: 18,
  },
  axlUSDC: {
    address: '0xca01a1d0993565291051daff390892518acfad3a',
    decimals: 6,
  },
  CP: {
    address: '0x6021d2c27b6fbd6e7608d1f39b41398caee2f824',
    decimals: 18,
  },
  STELLA: {
    address: '0x0e358838ce72d5e61e0018a2ffac4bec5f4c88d2',
    decimals: 18,
  },
}

export const algebraPoolsMap: Record<string, { address: `0x${string}`; token0: string; token1: string }> = {
  'WGLMR-xcDOT': {
    address: '0xc295aa4287127C5776Ad7031648692659eF2ceBB',
    token0: 'WGLMR',
    token1: 'xcDOT',
  },
  'WGLMR-xcUSDC': {
    address: '0x8b86404faa0269fc18c6abb091e551454b29bc30',
    token0: 'WGLMR',
    token1: 'xcUSDC',
  },
  'xcDOT-xcUSDT': {
    address: '0x921b35e54b45b60ee8142fa234baeb2ff5e307e0',
    token0: 'xcDOT',
    token1: 'xcUSDT',
  },
  'xcUSDC-xcUSDT': {
    address: '0x71785b1a85b158ef7b59ef4c0feb72430cc3de12',
    token0: 'xcUSDC',
    token1: 'xcUSDT',
  },
  'axlUSDC-xcUSDC': {
    address: '0x28137d36ad945b0c1b35f2bf90cfe6ff6cb87511',
    token0: 'axlUSDC',
    token1: 'xcUSDC',
  },
  'CP-xcUSDT': {
    address: '0x4f531a1258e2ea3c8347130201810ec65e6571c5',
    token0: 'CP',
    token1: 'xcUSDT',
  },
  'xcWBTC.e-xcDOT': {
    address: '0x820a417f5e2b4383987300c23f75cdadf01304aa',
    token0: 'xcWBTC.e',
    token1: 'xcDOT',
  },
  'xcDOT-ETH.e': {
    address: '0x2232e98829f985c95c6930342b607496cad7a560',
    token0: 'xcDOT',
    token1: 'ETH.e',
  },
  'STELLA-WGLMR': {
    address: '0x2cc4c3a48432f5bc5ad8c449ff0910e0531b7f1f',
    token0: 'STELLA',
    token1: 'WGLMR',
  },
  'STELLA-xcUSDC': {
    address: '0xaac5b58833a1e4264b0c1da8c0154779c714583b',
    token0: 'STELLA',
    token1: 'xcUSDC',
  },
  'WETH-ETH.e': {
    address: '0x01ae92b87af1b21720871d445e1e5a7f991332eb',
    token0: 'WETH',
    token1: 'ETH.e',
  },
} as const

export const algebraPools = Object.values(algebraPoolsMap)
