import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import { networks } from '../common/networks.js'

export const CONFIG: {
  origin: Record<NetworkURN, HexString[]>
  destination: Record<NetworkURN, HexString[]>
} = {
  origin: {
    [networks.base]: ['0xf5b9334e44f800382cb47fc19669401d694e529b'],
    [networks.ethereum]: ['0xa72e2bf29c840eb93adbb9ee1aa41580f01c9944'],
  },
  destination: {
    [networks.hydration]: [
      '0x70e9b12c3b19cb5f0e59984a5866278ab69df976', // Base EURC (archived)
      '0x35bf3a1b9ac564c8f66c97cea1ee410cd3f97c8a',
    ],
  },
}
