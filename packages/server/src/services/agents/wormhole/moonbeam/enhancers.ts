import { asJSON } from '@/common/util.js'
import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'

import { PayloadEnhancer } from '../mappers/payload.js'
import { WormholeIds } from '../types/chain.js'
import { decodeGmpInstruction } from './gmp.js'

const GMP_PRECOMPILE = '0x0000000000000000000000000000000000000816'

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

    instructions.push(gmpInstruction)

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
