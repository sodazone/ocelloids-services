import { asJSON } from '@/common/util.js'
import { NetworkURN } from '@/lib.js'
import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { getConsensus } from '@/services/config.js'
import { PayloadEnhancer } from '../mappers/payload.js'
import { WormholeIds } from '../types/chain.js'
import { decodeGmpInstruction, GmpInstruction } from './gmp.js'

const GMP_PRECOMPILE = '0x0000000000000000000000000000000000000816'

// Moonbeam GMP precompile used for MRL
function updateGmpJourney(gmpInstruction: GmpInstruction, journey: NewJourney) {
  if (gmpInstruction.gmp.resolved.urn) {
    const gmpChainId = journey.destination
    journey.destination = gmpInstruction.gmp.resolved.urn
    journey.destination_protocol = 'xcm'
    if (journey.stops) {
      const stops = JSON.parse(journey.stops)
      stops.push({
        type: 'hrmp',
        from: { chainId: gmpChainId },
        to: { chainId: journey.destination },
        relay: { chainId: `urn:ocn:${getConsensus(journey.destination as NetworkURN)}:0` },
      })
      journey.stops = asJSON(stops)
    }
  }
  if (gmpInstruction.gmp.resolved.address) {
    journey.to = gmpInstruction.gmp.resolved.address.key
    journey.to_formatted = gmpInstruction.gmp.resolved.address.formatted
  }
}

function gmpEnhancer(payload: bigint | Uint8Array, _assetOp: NewAssetOperation, journey: NewJourney) {
  try {
    // Here we know the final destination, but will be by a connecting journey
    const gmpInstruction = decodeGmpInstruction(payload)

    let instructions: any[] = []
    if (journey.instructions) {
      try {
        instructions = JSON.parse(journey.instructions)
        if (!Array.isArray(instructions)) {
          instructions = [instructions]
        }
      } catch {
        instructions = []
      }
    }

    if (gmpInstruction !== null) {
      instructions.push(gmpInstruction)
      updateGmpJourney(gmpInstruction, journey)
    }

    journey.instructions = asJSON(instructions)
  } catch (err) {
    console.error(err, `Error enhancing GMP precompile for journey ${journey.correlation_id}`)
  }
}

export const moonbeamEnhancers: Record<string, Record<string, PayloadEnhancer>> = {
  [WormholeIds.MOONBEAM_ID]: {
    [GMP_PRECOMPILE]: gmpEnhancer,
  },
}
