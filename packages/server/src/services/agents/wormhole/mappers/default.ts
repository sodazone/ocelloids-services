import { asJSON } from '@/common/util.js'
import { AnyJson } from '@/lib.js'
import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { addressToHex } from '@/services/agents/wormhole/types/address.js'
import { chainIdToUrn, MOONBEAM_URN, WormholeIds } from '@/services/agents/wormhole/types/chain.js'
import { toUTCMillis } from '@/services/archive/time.js'
import { toStatus } from '@/services/networking/apis/wormhole/status.js'
import {
  WormholeAction,
  WormholeOperation,
  WormholeProtocol,
} from '@/services/networking/apis/wormhole/types.js'

function prefer(a?: string | null, b?: string | null): string {
  const isZeroAddress = typeof a === 'string' && a === '0x0000000000000000000000000000000000000000'

  if (isZeroAddress && b) {
    return b
  }

  return a ?? b ?? ''
}

/**
 * Default mapping from WormholeOperation to NewJourney
 */
export function defaultJourneyMapping(
  op: WormholeOperation,
  type: WormholeAction,
  protocol: WormholeProtocol,
  generateTripId: (identifiers?: { chainId: string; values: string[] }) => string,
): NewJourney {
  const s = op.content?.standarizedProperties ?? {}
  const from = prefer(op.sourceChain?.from, s.fromAddress)
  const to = prefer(s.toAddress, op.targetChain?.to)

  const origin = chainIdToUrn(s.fromChain > 0 ? s.fromChain : op.emitterChain)
  const destination = chainIdToUrn(s.toChain > 0 ? s.toChain : (op.targetChain?.chainId ?? op.emitterChain))

  const txHash =
    origin === MOONBEAM_URN
      ? op.sourceChain?.transaction?.txHash
      : destination === MOONBEAM_URN
        ? op.targetChain?.transaction?.txHash
        : undefined
  const tripId = txHash
    ? generateTripId({ chainId: chainIdToUrn(WormholeIds.MOONBEAM_ID), values: [txHash] })
    : undefined

  return {
    trip_id: tripId,
    correlation_id: op.id,
    status: toStatus(op, origin === destination),
    type,
    origin_protocol: protocol,
    destination_protocol: protocol,
    origin,
    destination,
    from: addressToHex(from),
    to: addressToHex(to),
    from_formatted: from,
    to_formatted: to,
    sent_at: op.sourceChain?.timestamp ? toUTCMillis(op.sourceChain.timestamp) : undefined,
    recv_at: op.targetChain?.timestamp ? toUTCMillis(op.targetChain.timestamp) : undefined,
    created_at: Date.now(),
    stops: asJSON(toWormholeStops(op)),
    instructions: '[]',
    transact_calls: '[]',
    origin_tx_primary: op.sourceChain?.transaction?.txHash ?? null,
    origin_tx_secondary: op.sourceChain?.transaction?.secondTxHash ?? null,
    destination_tx_primary: op.targetChain?.transaction?.txHash ?? null,
    destination_tx_secondary: op.targetChain?.transaction?.secondTxHash ?? null,
  }
}

/**
 * Default asset mapping with safe fallbacks
 */
export function defaultAssetMapping(op: WormholeOperation, journey: NewJourney): NewAssetOperation[] {
  try {
    const s = op.content?.standarizedProperties ?? {}

    if (!s.tokenAddress) {
      journey.type = 'transact'
      return []
    }

    return [
      {
        journey_id: -1,
        asset: s.tokenAddress,
        symbol: undefined,
        amount: s.amount ?? '0',
        decimals: s.normalizedDecimals ?? 0,
        usd: undefined,
        role: 'transfer',
        sequence: 0,
      },
    ]
  } catch (err) {
    console.error('Error mapping Wormhole asset', err, op)
    return []
  }
}

export function toWormholeStops(op: WormholeOperation): AnyJson[] {
  const s = op.content?.standarizedProperties ?? {}
  const fromChainId = chainIdToUrn(s.fromChain > 0 ? s.fromChain : op.emitterChain)
  const toChainId = chainIdToUrn(s.toChain > 0 ? s.toChain : (op.targetChain?.chainId ?? op.emitterChain))
  const sameOrigin = fromChainId === toChainId

  return [
    {
      type: 'wormhole',

      from: {
        chainId: fromChainId,
        timestamp: op.sourceChain?.timestamp ? toUTCMillis(op.sourceChain.timestamp) : undefined,
        status: op.sourceChain?.status ?? 'unknown',
        tx: op.sourceChain?.transaction,
      },

      to: op.targetChain
        ? {
            chainId: toChainId,
            timestamp: toUTCMillis(op.targetChain?.timestamp),
            status: op.targetChain?.status ?? 'unknown',
            tx: op.targetChain?.transaction,
          }
        : {
            chainId: toChainId,
            status: sameOrigin ? 'completed' : 'pending',
          },

      relay:
        !sameOrigin && op.targetChain?.status === undefined
          ? {
              chainId: 'urn:ocn:wormhole:1',
              status: 'pending',
              vaaId: op.id,
            }
          : {
              chainId: 'urn:ocn:wormhole:1',
              status: 'completed',
              vaaId: op.id,
            },

      messageId: op.id ?? null,

      instructions: {
        type: 'WormholeVAA',
        value: op.vaa,
      },
    },
  ]
}
