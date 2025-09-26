import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { PayloadPortalTokenBridge, WormholeOperation } from '@/services/networking/apis/wormhole/types.js'
import { defaultAssetMapping, defaultJourneyMapping } from './default.js'
import { TMP_ASSET_DECIMALS, padAmountIfNeeded } from './util.js'

function mapPortalOpToJourney(op: WormholeOperation<PayloadPortalTokenBridge>): NewJourney {
  return defaultJourneyMapping(op, 'transfer', 'wh_portal')
}

function mapPortalOpToAssets(
  op: WormholeOperation<PayloadPortalTokenBridge>,
  journey: NewJourney,
): NewAssetOperation[] {
  const p = op.content.payload
  const d = op.data
  const usdAmount = d['usdAmount']
  const symbol = d['symbol']
  const decimals = TMP_ASSET_DECIMALS[symbol] ?? 0

  if ('amount' in p && 'tokenAddress' in p) {
    return [
      {
        journey_id: -1,
        asset: p.tokenAddress,
        symbol,
        amount: padAmountIfNeeded(p.amount, d['tokenAmount'], decimals),
        decimals,
        usd: usdAmount ? parseFloat(usdAmount) : undefined,
        role: 'transfer',
        sequence: 0,
      },
    ]
  }

  return defaultAssetMapping(op, journey)
}

// Narrows WormholeOperation's payload if appIds contains PORTAL_TOKEN_BRIDGE
type PortalTokenBridgeOperation = Omit<WormholeOperation, 'content'> & {
  content: Omit<WormholeOperation['content'], 'payload'> & {
    payload: PayloadPortalTokenBridge
  }
}

function isPortalTokenBridge(op: WormholeOperation): op is PortalTokenBridgeOperation {
  return op.content.standarizedProperties.appIds.includes('PORTAL_TOKEN_BRIDGE')
}

export const PortalMapper = {
  guard: isPortalTokenBridge,
  mapJourney: mapPortalOpToJourney,
  mapAssets: mapPortalOpToAssets,
}
