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
  xcUSDC: {
    address: '0xffffffff7d2b0b761af01ca8e25242976ac0ad7d',
    decimals: 6,
  },
  xcUSDT: {
    address: '0xffffffffea09fb06d082fd1275cd48b191cbcd1d',
    decimals: 6,
  },
  axlUSDC: {
    address: '0xca01a1d0993565291051daff390892518acfad3a',
    decimals: 6,
  },
}

export const algebraPools: Record<string, { address: `0x${string}`; token0: string; token1: string }> = {
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
}
