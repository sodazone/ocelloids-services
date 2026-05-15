import { networks } from '@/services/agents/common/networks.js'

export const CHAIN_ID = networks.hydration
export const EVM_CHAIN_ID = 'urn:ocn:ethereum:222222'
export const FACILITATOR_ASCII = 'modlpy/hsmod'
export const OMNIPOOL_ASCII = 'modlomnipool'

export const HOLLAR_ID = 222
export const HOLLAR_EVM_ADDRESS = '0x531a654d1696ED52e7275A8cede955E82620f99a'

export const ASSET_ID_MAP = new Map<string, number>([[HOLLAR_EVM_ADDRESS, HOLLAR_ID]])

export const AaveV3HydrationMainnet = {
  POOL_ADDRESSES_PROVIDER: '0xf3Ba4D1b50f78301BDD7EAEa9B67822A15FCA691',
  POOL: '0x1b02E051683b5cfaC5929C25E84adb26ECf87B38',
  WETH_GATEWAY: '',
  FAUCET: '',
  WALLET_BALANCE_PROVIDER: '0x0AFCD36f29BbC1Ae40007ff289901Ae442558796',
  UI_POOL_DATA_PROVIDER: '0x112b087b60C1a166130d59266363C45F8aa99db0',
  UI_INCENTIVE_DATA_PROVIDER: '0x23711ED88aFd7C9930a7337e5AacA3DAcC780FEc',
  GHO_TOKEN_ADDRESS: '',
  GHO_UI_DATA_PROVIDER: '',
  COLLECTOR: '0xE52567fF06aCd6CBe7BA94dc777a3126e180B6d9',
}

export const AAVE_GAS_LIMIT = 1_000_000n
export const AAVE_ROUNDING_THRESHOLD = 5
export const AAVE_UINT_256_MAX = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
