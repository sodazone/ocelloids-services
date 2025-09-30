import { deserialize, deserializePayload } from '@wormhole-foundation/sdk-definitions'

import { NewJourney } from '@/services/agents/crosschain/index.js'
import { PayloadPortalTokenBridge, WormholeOperation } from '@/services/networking/apis/wormhole/types.js'
import { addressToHex } from '../address.js'
import { tokenAddressToAssetId } from '../chain.js'
import { decodeGmpPayload } from '../gmp.js'
import { TOKEN_REGISTRY } from '../metadata/tokens.js'
import { defaultJourneyMapping } from './default.js'

const Discriminator: Record<number, string> = {
  0x01: 'TokenBridge:Transfer',
  0x03: 'TokenBridge:TransferWithPayload',
} as const

function decodeTransferPayload(vaa: string) {
  const vaaBytes = new Uint8Array(Buffer.from(vaa, 'base64'))
  const { payload } = deserialize('Uint8Array', vaaBytes)
  const discriminator = Discriminator[payload[0]]
  if (!discriminator) {
    return null
  }

  return deserializePayload(
    discriminator as 'TokenBridge:Transfer' | 'TokenBridge:TransferWithPayload',
    payload,
  )
}

function mapPortalOpToJourney(op: WormholeOperation<PayloadPortalTokenBridge>): NewJourney {
  return defaultJourneyMapping(op, 'transfer', 'wh_portal')
}

function mapPortalOpToAssets(op: WormholeOperation<PayloadPortalTokenBridge>, _journey: NewJourney) {
  try {
    const {
      tokenAddress,
      tokenChain,
      wrappedTokenSymbol,
      amount: rawAmount,
    } = op.content.standarizedProperties

    let amount = rawAmount
    const tokenDecimals = 0
    const payload = op.vaa?.raw ? decodeTransferPayload(op.vaa.raw) : undefined
    // TODO: handle precompiles properly and in a generic way
    if (payload?.token) {
      // 0x0f27270ad8e98ba25c6fbde8e578d0bc40a62a9fd12feb35d49d6214c1aa56cd
      console.log(
        'TRANSFER PAYLOAD',
        payload.to.address.toString(),
        payload.payload ? Buffer.from(payload.payload as Uint8Array).toString('hex') : 'none',
      )
      if (
        payload.to.address.toString() === '0x0000000000000000000000000000000000000000000000000000000000000816'
      ) {
        console.log(
          'GMP',
          JSON.stringify(
            decodeGmpPayload(`0x${Buffer.from(payload.payload as Uint8Array).toString('hex')}`),
            null,
            2,
          ),
        )
      }
      const tokenAmount = payload.token.amount.toString()
      if (rawAmount !== tokenAmount) {
        // XXX
        console.log('patching wrong reported amount', rawAmount, tokenAmount, op.id)
        amount = tokenAmount
      }
    }

    const key = `${tokenChain}:${String(tokenAddress).toLowerCase()}`
    const tokenInfo = TOKEN_REGISTRY[key]
    const decimals = tokenInfo?.decimals ?? tokenDecimals
    const symbol = tokenInfo?.symbol ?? wrappedTokenSymbol ?? undefined
    const isNative = !!tokenInfo?.treatAsNative

    const tokenIdentifier = String(tokenAddress).startsWith('0x')
      ? addressToHex(tokenAddress)
      : String(tokenAddress)

    const assetUrn = tokenAddressToAssetId(tokenChain, isNative ? 'native' : tokenIdentifier)

    return [
      {
        journey_id: -1,
        asset: assetUrn,
        symbol,
        amount,
        decimals,
        usd: undefined,
        role: 'transfer',
        sequence: 0,
      },
    ]
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
