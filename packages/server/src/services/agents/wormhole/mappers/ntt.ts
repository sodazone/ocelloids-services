import { PayloadNativeTokenTransfer, WormholeOperation } from '@/services/networking/apis/wormhole/types.js'
import { NewAssetOperation, NewJourney } from '../../crosschain/index.js'
import { nttManagerDigestFromOp } from '../ntt/digest.js'
import { WormholeIds } from '../types/chain.js'
import { wormholeAmountToReal } from '../types/decimals.js'
import { defaultJourneyMapping } from './default.js'
import { MapAssetContext, MapJourneyContext } from './index.js'

type NativeTokenTransferOperation = Omit<WormholeOperation, 'content'> & {
  content: Omit<WormholeOperation['content'], 'payload'> & {
    payload: PayloadNativeTokenTransfer
  }
}

function isNativeTokenTransfer(op: WormholeOperation): op is NativeTokenTransferOperation {
  return op.content?.standarizedProperties?.appIds?.includes('NATIVE_TOKEN_TRANSFER') ?? false
}

function mapNTTOpToJourney(
  op: WormholeOperation<PayloadNativeTokenTransfer>,
  ctx: MapJourneyContext,
): NewJourney {
  const j = defaultJourneyMapping(op, 'transfer', 'wh_ntt', ctx)
  if (op.vaa && op.content.standarizedProperties.toChain === WormholeIds.HYDRATION_ID) {
    try {
      j.trip_id = nttManagerDigestFromOp(op.emitterChain, op.vaa.raw)
    } catch (error) {
      console.error('[NTTMapper] while generating manager digest', error)
    }
  }
  return j
}

async function mapNTTOpToAssets(op: WormholeOperation<PayloadNativeTokenTransfer>, ctx: MapAssetContext) {
  try {
    const {
      tokenAddress,
      tokenChain,
      wrappedTokenSymbol,
      amount: rawAmount,
      normalizedDecimals,
    } = op.content.standarizedProperties

    let decimals = normalizedDecimals ?? 8
    let baseDecimals = 8
    let symbol = '???'
    let assetUrn = ''

    const tokenInfo = await ctx.tokenRegistry?.lookup(tokenChain, tokenAddress)
    if (tokenInfo) {
      decimals = tokenInfo.decimals ?? decimals
      symbol = tokenInfo.symbol ?? wrappedTokenSymbol ?? symbol
      assetUrn = tokenInfo.tokenUrn
    } else {
      console.warn(
        `[NTTMapper] Token not found in registry: ${tokenChain} ${tokenAddress}. Using unknown token ??? fallback.`,
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

    return [assetOp]
  } catch (error) {
    console.error('Error mapping NTT asset', error, op)
    return []
  }
}

export const NTTMapper = {
  guard: isNativeTokenTransfer,
  mapJourney: mapNTTOpToJourney,
  mapAssets: mapNTTOpToAssets,
}
