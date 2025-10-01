import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { PayloadPortalTokenBridge, WormholeOperation } from '@/services/networking/apis/wormhole/types.js'
import { addressToHex } from '../address.js'
import { tokenAddressToAssetId } from '../chain.js'
import { wormholeAmountToReal } from '../decimals.js'
import { tokenRegistry } from '../metadata/tokens.js'
import { defaultJourneyMapping } from './default.js'
import { decodeTransferPayload, resolvePayloadEnhancer } from './payload.js'

function mapPortalOpToJourney(op: WormholeOperation<PayloadPortalTokenBridge>): NewJourney {
  return defaultJourneyMapping(op, 'transfer', 'wh_portal')
}

function mapPortalOpToAssets(op: WormholeOperation<PayloadPortalTokenBridge>, journey: NewJourney) {
  try {
    const {
      tokenAddress,
      tokenChain,
      wrappedTokenSymbol,
      amount: rawAmount,
      normalizedDecimals,
      toAddress,
      toChain,
    } = op.content.standarizedProperties

    const tokenInfo = tokenRegistry.lookup(tokenChain, tokenAddress)

    let decimals = normalizedDecimals ?? 8
    let symbol = '???'
    let isNative = false

    if (tokenInfo) {
      decimals = tokenInfo.decimals ?? decimals
      symbol = tokenInfo.symbol ?? wrappedTokenSymbol ?? symbol
      isNative = !!tokenInfo.treatAsNative
    } else {
      console.warn(
        `[PortalMapper] Token not found in registry: ${tokenChain} ${tokenAddress}. Using unknown token ??? fallback.`,
      )
    }

    const realAmount = wormholeAmountToReal(rawAmount, decimals, normalizedDecimals)

    const tokenIdentifier = String(tokenAddress).startsWith('0x')
      ? addressToHex(tokenAddress)
      : String(tokenAddress)

    const assetUrn = tokenAddressToAssetId(tokenChain, isNative ? 'native' : tokenIdentifier)

    const assetOp: NewAssetOperation = {
      journey_id: -1,
      asset: assetUrn,
      symbol,
      amount: realAmount,
      decimals,
      usd: op.data?.usdAmount ? parseFloat(op.data.usdAmount) : undefined,
      role: 'transfer',
      sequence: 0,
    }

    const enhancer = resolvePayloadEnhancer({
      address: toAddress.toLowerCase(),
      chain: toChain,
    })
    if (op.vaa?.raw && enhancer) {
      const payload = decodeTransferPayload(op.vaa.raw)
      if (payload) {
        if (enhancer) {
          enhancer(payload.payload, assetOp, journey)
        }
      }
    }

    return [assetOp]
  } catch (error) {
    console.error('Error mapping portal asset', error, op)
    return []
  }
}

type PortalTokenBridgeOperation = Omit<WormholeOperation, 'content'> & {
  content: Omit<WormholeOperation['content'], 'payload'> & {
    payload: PayloadPortalTokenBridge
  }
}

function isPortalTokenBridge(op: WormholeOperation): op is PortalTokenBridgeOperation {
  return op.content?.standarizedProperties?.appIds?.includes('PORTAL_TOKEN_BRIDGE') ?? false
}

export const PortalMapper = {
  guard: isPortalTokenBridge,
  mapJourney: mapPortalOpToJourney,
  mapAssets: mapPortalOpToAssets,
}
