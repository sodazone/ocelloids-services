import { JourneyStatus } from '@/services/agents/crosschain/index.js'
import { WormholeOperation } from './types.js'

/**
 * Map Wormhole chain status to Journey status
 */
export function toStatus(op: WormholeOperation): JourneyStatus {
  try {
    if (op.targetChain?.status === 'completed') {
      return 'received'
    }
    if (['in_progress', 'confirmed'].includes(op.sourceChain.status)) {
      return 'sent'
    }
    return 'unknown'
  } catch (err) {
    console.error('Error deriving status for Wormhole operation', err, op)
    return 'unknown'
  }
}
