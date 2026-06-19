import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import { networks } from '../common/networks.js'

export const CONFIG: {
  origin: Record<NetworkURN, HexString>
  relay: Record<NetworkURN, HexString>
  destination: Record<NetworkURN, HexString>
} = {
  origin: {
    [networks.base]: '0xf5b9334e44f800382cb47fc19669401d694e529b',
  },
  relay: {
    [networks.moonbeam]: '0xf5b9334e44f800382cb47fc19669401d694e529b',
  },
  destination: {
    [networks.hydration]: '0x70e9b12c3b19cb5f0e59984a5866278ab69df976',
  },
}
