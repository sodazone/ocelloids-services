import { HexString } from '@/lib.js'
import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { addressToHex } from '../address.js'
import { tokenAddressToAssetId } from '../chain.js'
import { decodeRelayerPayload, getRelayerInfo } from '../relayers/decode.js'
import { WormholeOperation } from '../types.js'
import { defaultAssetMapping, defaultJourneyMapping } from './default.js'

function mapRelayerOpToJourney(op: WormholeOperation): NewJourney {
  return defaultJourneyMapping(op, 'transfer', 'wh_relayer')
}

function mapRelayerOpToAssets(op: WormholeOperation, journey: NewJourney): NewAssetOperation[] {
  const assetOps = defaultAssetMapping(op, journey)

  const s = op.content.standarizedProperties
  const relayerInfo = getRelayerInfo(s.toChain, s.toAddress)
  if (relayerInfo) {
    const decoded = decodeRelayerPayload(relayerInfo, `0x${(op.content.payload as any).payload}` as HexString)
    if ('amount' in decoded) {
      const assetOp = {
        journey_id: -1,
        amount: String(decoded['amount']),
        asset: tokenAddressToAssetId(op.targetChain.chainId, decoded['token']),
      }
      assetOps.push(assetOp)
    }
    journey.to = addressToHex(decoded['to'])
    journey.type = 'transfer'
  }

  return assetOps
}

function isGenericRelayer(op: WormholeOperation) {
  return op.content?.standarizedProperties?.appIds?.includes('GENERIC_RELAYER') ?? false
}

export const RelayerMapper = {
  guard: isGenericRelayer,
  mapJourney: mapRelayerOpToJourney,
  mapAssets: mapRelayerOpToAssets,
}
