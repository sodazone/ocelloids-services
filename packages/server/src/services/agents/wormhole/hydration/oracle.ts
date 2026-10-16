import { deserialize } from '@wormhole-foundation/sdk-definitions'
import { bytesToHex, decodeAbiParameters } from 'viem'
import { asJSON } from '@/common/util.js'
import { WormholeOperation } from '@/services/networking/apis/wormhole/types.js'
import { NewJourney } from '../../crosschain/index.js'
import { WormholeIds } from '../../steward/metadata/queries/wormhole.js'
import { defaultAssetMapping, defaultJourneyMapping } from '../mappers/default.js'
import { MapJourneyContext } from '../mappers/index.js'

const ORACLE_EMTTERS = ['0x3f5cc44141a52529323f9be42dbb98fda7c1d066'].map((a) => a.toLowerCase())

function isOracleUpdate(op: WormholeOperation): boolean {
  return (
    op.vaa?.raw !== undefined &&
    op.emitterChain === WormholeIds.HYDRATION_ID &&
    ORACLE_EMTTERS.includes(op.emitterAddress.native.toLowerCase())
  )
}

function mapOracleUpdateToJourney(op: WormholeOperation, ctx: MapJourneyContext): NewJourney {
  const j = defaultJourneyMapping(op, 'transact', 'wh', ctx)

  const vaa = op.vaa?.raw
  if (!vaa) {
    return j
  }

  const vaaBytes = new Uint8Array(Buffer.from(vaa, 'base64'))
  const { payload } = deserialize('Uint8Array', vaaBytes)

  try {
    const [action, assetId, rate, timestamp] = decodeAbiParameters(
      [
        { type: 'uint8', name: 'action' },
        { type: 'bytes32', name: 'assetId' },
        { type: 'uint256', name: 'rate' },
        { type: 'uint64', name: 'timestamp' },
      ],
      bytesToHex(payload),
    )
    const call = {
      module: action === 2 ? 'Oracle' : undefined,
      method: action === 2 ? 'rate_update' : undefined,
      args: {
        action,
        assetId,
        rate,
        timestamp,
      },
    }
    j.transact_calls = asJSON([call])
    return j
  } catch (_e) {
    return j
  }
}

export const HydrationOracleMapping = {
  guard: isOracleUpdate,
  mapJourney: mapOracleUpdateToJourney,
  mapAssets: defaultAssetMapping,
}
