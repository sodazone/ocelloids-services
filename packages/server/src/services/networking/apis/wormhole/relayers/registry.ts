import { WormholeIds } from '../consts.js'

export type RelayerInfo = {
  token: string
  abi: string
}

export const relayerContracts: Record<number, Record<string, RelayerInfo>> = {
  // Base
  [WormholeIds.BASE_ID]: {
    '0x734AbBCe07679C9A6B4Fe3bC16325e028fA6DbB7': {
      // Moonwell relayer
      token: '0xA88594D404727625A9437C3f886C7643872296AE', // WELL, 18 decimals
      abi: 'function bridge(address to, uint256 amount)',
    },
  },
  // Moonbeam
  [WormholeIds.MOONBEAM_ID]: {
    // ...
  },
}
