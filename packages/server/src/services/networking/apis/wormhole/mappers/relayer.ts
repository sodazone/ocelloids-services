import { HexString } from '@/lib.js'
import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { decodeRelayerPayload, getRelayerInfo } from '../relayers/decode.js'
import { WormholeOperation } from '../types.js'
import { defaultAssetMapping, defaultJourneyMapping } from './default.js'

function mapRelayerOpToJourney(op: WormholeOperation): NewJourney {
  return defaultJourneyMapping(op, 'transfer', 'wh_relayer')
}

function mapRelayerOpToAssets(op: WormholeOperation, journey: NewJourney): NewAssetOperation[] {
  const assetOp = defaultAssetMapping(op)

  const s = op.content.standarizedProperties
  const relayerInfo = getRelayerInfo(s.toChain, s.toAddress)
  if (relayerInfo) {
    const decoded = decodeRelayerPayload(relayerInfo, `0x${(op.content.payload as any).payload}` as HexString)
    console.log('decoded relayer payload', decoded)
    if ('amount' in decoded) {
      assetOp[0].amount = String(decoded['amount'])
      assetOp[0].asset = decoded['token']
    }
    journey.to = decoded['to']
  }

  return assetOp
}

function isGenericRelayer(op: WormholeOperation) {
  return op.content.standarizedProperties.appIds.includes('GENERIC_RELAYER')
}

export const RelayerMapper = {
  guard: isGenericRelayer,
  mapJourney: mapRelayerOpToJourney,
  mapAssets: mapRelayerOpToAssets,
}
