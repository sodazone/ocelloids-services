import { HexString } from '@/lib.js'
import { PayloadNativeTokenTransfer, WormholeOperation } from '@/services/networking/apis/wormhole/types.js'
import { hexToAssetId, isAssetAddress } from '../../common/hydration.js'
import { NewAssetOperation, NewJourney } from '../../crosschain/index.js'
import { tokenRegistry } from '../metadata/tokens.js'
import { addressToHex } from '../types/address.js'
import { tokenAddressToAssetId, WormholeIds } from '../types/chain.js'
import { wormholeAmountToReal } from '../types/decimals.js'
import { defaultJourneyMapping } from './default.js'

type NativeTokenTransferOperation = Omit<WormholeOperation, 'content'> & {
  content: Omit<WormholeOperation['content'], 'payload'> & {
    payload: PayloadNativeTokenTransfer
  }
}

function isNativeTokenTransfer(op: WormholeOperation): op is NativeTokenTransferOperation {
  return op.content?.standarizedProperties?.appIds?.includes('NATIVE_TOKEN_TRANSFER') ?? false
}

function mapPortalOpToJourney(
  op: WormholeOperation<PayloadNativeTokenTransfer>,
  generateTripId: (identifiers?: { chainId: string; values: string[] }) => string,
): NewJourney {
  return defaultJourneyMapping(op, 'transfer', 'wh_ntt', generateTripId)
}

function mapPortalOpToAssets(op: WormholeOperation<PayloadNativeTokenTransfer>, _journey: NewJourney) {
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
    let isNative = false

    const tokenInfo = tokenRegistry.lookup(tokenChain, tokenAddress)

    if (tokenInfo) {
      decimals = tokenInfo.decimals ?? decimals
      symbol = tokenInfo.symbol ?? wrappedTokenSymbol ?? symbol
      isNative = !!tokenInfo.isNative
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

    // TODO: the final assetUrn must come from the registry as well and the registry
    // will have access to the Steward to resolve metadata when possible
    const tokenIdentifier = String(tokenAddress).startsWith('0x')
      ? tokenChain === WormholeIds.HYDRATION_ID && isAssetAddress(tokenAddress as HexString)
        ? String(hexToAssetId(tokenAddress as HexString))
        : addressToHex(tokenAddress)
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

    return [assetOp]
  } catch (error) {
    console.error('Error mapping NTT asset', error, op)
    return []
  }
}

export const NTTMapper = {
  guard: isNativeTokenTransfer,
  mapJourney: mapPortalOpToJourney,
  mapAssets: mapPortalOpToAssets,
}
