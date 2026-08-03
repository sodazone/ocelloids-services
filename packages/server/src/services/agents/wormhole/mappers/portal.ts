import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { PayloadPortalTokenBridge, WormholeOperation } from '@/services/networking/apis/wormhole/types.js'
import { wormholeAmountToReal } from '../types/decimals.js'
import { defaultJourneyMapping } from './default.js'
import { MapAssetContext, MapJourneyContext } from './index.js'
import { decodeTransferPayload, resolvePayloadEnhancer } from './payload.js'

function mapPortalOpToJourney(
  op: WormholeOperation<PayloadPortalTokenBridge>,
  ctx: MapJourneyContext,
): NewJourney {
  return defaultJourneyMapping(op, 'transfer', 'wh_portal', ctx)
}

async function mapPortalOpToAssets(op: WormholeOperation<PayloadPortalTokenBridge>, ctx: MapAssetContext) {
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

    const tokenInfo = await ctx.tokenRegistry?.lookup(tokenChain, tokenAddress)

    let decimals = normalizedDecimals ?? 8
    let baseDecimals = normalizedDecimals
    let symbol = '???'
    let assetUrn = ''

    if (tokenInfo) {
      decimals = tokenInfo.decimals ?? decimals
      symbol = tokenInfo.symbol ?? wrappedTokenSymbol ?? symbol
      assetUrn = tokenInfo.tokenUrn
    } else {
      console.warn(
        `[PortalMapper] Token not found in registry: ${tokenChain} ${tokenAddress}. Using unknown token ??? fallback.`,
      )
    }

    let amount = rawAmount
    if (amount == null || amount === '') {
      const tokenAmount = op.data?.tokenAmount

      if (typeof tokenAmount === 'string' && tokenAmount.trim() !== '') {
        try {
          const [whole, dec] = tokenAmount.split('.')
          baseDecimals = dec ? dec.length : 0
          amount = [whole, dec].join('')
        } catch (err) {
          console.warn('Failed to convert tokenAmount to int:', tokenAmount, err)
          amount = '0'
        }
      } else {
        console.warn('Missing or invalid tokenAmount fallback:', tokenAmount)
        amount = '0'
      }
    }

    const realAmount = wormholeAmountToReal(amount, decimals, baseDecimals)

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
        if (assetOp.amount === '0' && payload.token?.amount !== undefined) {
          assetOp.amount = wormholeAmountToReal(payload.token.amount.toString(), decimals, normalizedDecimals)
        }
        if (enhancer) {
          enhancer(payload.payload, assetOp, ctx.journey)
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
