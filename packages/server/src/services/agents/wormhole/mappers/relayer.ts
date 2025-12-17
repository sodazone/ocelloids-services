import { HexString } from '@/lib.js'
import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { WormholeOperation } from '@/services/networking/apis/wormhole/types.js'
import { tokenRegistry } from '../metadata/tokens.js'
import { decodeRelayerPayload, getRelayerInfo } from '../relayers/decode.js'
import { addressToHex } from '../types/address.js'
import { tokenAddressToAssetId } from '../types/chain.js'
import { defaultAssetMapping, defaultJourneyMapping } from './default.js'

function mapRelayerOpToJourney(
  op: WormholeOperation,
  generateTripId: (identifiers?: { chainId: string; values: string[] }) => string,
): NewJourney {
  return defaultJourneyMapping(op, 'transfer', 'wh_relayer', generateTripId)
}

function mapRelayerOpToAssets(op: WormholeOperation, journey: NewJourney): NewAssetOperation[] {
  const assetOps: NewAssetOperation[] = [...defaultAssetMapping(op, journey)]

  const s = op.content.standarizedProperties
  const relayerInfo = getRelayerInfo(s.toChain, s.toAddress)
  if (!relayerInfo) {
    return assetOps
  }

  try {
    const decoded = decodeRelayerPayload(relayerInfo, `0x${(op.content.payload as any).payload}` as HexString)

    if ('amount' in decoded && 'token' in decoded && 'to' in decoded) {
      const chainId = op.targetChain?.chainId ?? op.content.standarizedProperties.toChain
      const tokenAddr = decoded['token']
      const assetId = tokenAddressToAssetId(chainId, tokenAddr)
      const tokenInfo = tokenRegistry.lookup(chainId, tokenAddr)

      assetOps.push({
        journey_id: -1,
        role: 'transfer',
        sequence: assetOps.length,
        asset: assetId,
        amount: String(decoded['amount']),
        decimals: tokenInfo?.decimals ?? 0,
        symbol: tokenInfo?.symbol,
        usd: undefined, // fill later from pricing service
      })

      // update journey fields
      journey.to = addressToHex(decoded['to'])
      journey.type = 'transfer'
    }
  } catch (err) {
    console.error(`RelayerMapper: failed to decode payload for op ${op.id}`, err)
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
