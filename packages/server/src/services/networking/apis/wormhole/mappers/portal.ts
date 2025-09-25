import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { PayloadPortalTokenBridge, WormholeOperation } from '@/services/networking/apis/wormhole/types.js'
import { defaultAssetMapping, defaultJourneyMapping } from './default.js'

function mapPortalOpToJourney(op: WormholeOperation<PayloadPortalTokenBridge>): NewJourney {
  return defaultJourneyMapping(op, 'transfer', 'wh_portal')
}

/**
 */
export function padAmountIfNeeded(report: string, reportFormatted: string, decimals: number): string {
  // TODO solve this... :_
  return report
}

function mapPortalOpToAssets(op: WormholeOperation<PayloadPortalTokenBridge>): NewAssetOperation[] {
  const p = op.content.payload
  const d = op.data
  const usdAmount = d['usdAmount']
  const symbol = d['symbol']

  if ('amount' in p && 'tokenAddress' in p) {
    return [
      {
        journey_id: -1,
        asset: p.tokenAddress,
        symbol,
        // TODO: review and fix all this :D
        amount: ['SOL', 'WSOL'].includes(symbol)
          ? padAmountIfNeeded(p.amount, d['tokenAmount'], 9)
          : p.amount,
        // (!) NOTE: inferred decimals may not match the canonical decimals
        // of the token, are local to that specific operation
        // because wormhole reports a "local" amount in the standarizedProperties.amount in regard to data.tokenAmount (that is correct)
        // check:
        // https://wormholescan.io/#/tx/16/000000000000000000000000b1731c586ca89a23809861c6103f0b96b3f57d92/92864?network=Mainnet&view=advanced
        // https://moonscan.io/tx/0x88282911f1edc45de45d5dc070934bb4835cda9c4e13db932d12c0dd0172a3f2
        // from the batch call in 0x97dbe809547a934b636a48d547b1d0bd731c84c31d0edeffdcef9757063ffbb0
        // [16]: 0x026745789d0000... = 10322540701
        // [20]: 0x026745789d0000... = 10322540701
        // seems that the amount is truncated in the reported "amount" = 1032254070, should be 10322540700
        // tokenAmount = 10.3225407
        decimals: ['SOL', 'WSOL'].includes(symbol) ? 9 : 0,
        usd: usdAmount ? parseFloat(usdAmount) : undefined,
        role: 'transfer',
        sequence: 0,
      },
    ]
  }
  return defaultAssetMapping(op)
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
