import { JourneyStatus } from '@/services/agents/crosschain/index.js'
import { WormholeOperation } from './types.js'

/**
 * Map Wormhole chain status to Journey status
 */
export function toStatus(op: WormholeOperation, sameOriginDestination: boolean = false): JourneyStatus {
  try {
    if (op.targetChain?.status === 'completed') {
      return 'received'
    }

    if (sameOriginDestination && op.sourceChain?.status === 'confirmed') {
      return 'received'
    }

    if (op.vaa) {
      return 'waiting'
    } else {
      return 'sent'
    }
  } catch (err) {
    console.error('Error deriving status for Wormhole operation', err, op)
    return 'unknown'
  }
}
