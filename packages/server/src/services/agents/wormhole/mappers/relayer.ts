import { HexString } from '@/lib.js'
import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { WormholeOperation } from '@/services/networking/apis/wormhole/types.js'
import { decodeRelayerPayload, getRelayerInfo } from '../relayers/decode.js'
import { addressToHex } from '../types/address.js'
import { defaultAssetMapping, defaultJourneyMapping } from './default.js'
import { MapAssetContext, MapJourneyContext } from './index.js'

function mapRelayerOpToJourney(op: WormholeOperation, ctx: MapJourneyContext): NewJourney {
  return defaultJourneyMapping(op, 'transfer', 'wh_relayer', ctx)
}

async function mapRelayerOpToAssets(
  op: WormholeOperation,
  ctx: MapAssetContext,
): Promise<NewAssetOperation[]> {
  const assetOps: NewAssetOperation[] = [...defaultAssetMapping(op, ctx)]

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
      const tokenInfo = await ctx.tokenRegistry?.lookup(chainId, tokenAddr)

      assetOps.push({
        journey_id: -1,
        role: 'transfer',
        sequence: assetOps.length,
        asset: tokenInfo?.tokenUrn ?? '',
        amount: String(decoded['amount']),
        decimals: tokenInfo?.decimals ?? 0,
        symbol: tokenInfo?.symbol,
        usd: undefined, // fill later from pricing service
      })

      // update journey fields
      ctx.journey.to = addressToHex(decoded['to'])
      ctx.journey.type = 'transfer'
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
