import { asJSON } from '@/common/util.js'
import { AnyJson } from '@/lib.js'
import { NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { addressToHex } from '@/services/agents/wormhole/types/address.js'
import { chainIdToUrn } from '@/services/agents/wormhole/types/chain.js'
import { toUTCMillis } from '@/services/archive/time.js'
import { toStatus } from '@/services/networking/apis/wormhole/status.js'
import {
  WormholeAction,
  WormholeOperation,
  WormholeProtocol,
} from '@/services/networking/apis/wormhole/types.js'

/**
 * Default mapping from WormholeOperation to NewJourney
 */
export function defaultJourneyMapping(
  op: WormholeOperation,
  type: WormholeAction,
  protocol: WormholeProtocol,
): NewJourney {
  const s = op.content?.standarizedProperties ?? {}

  const from = op.sourceChain?.from ?? s.fromAddress ?? ''
  const to = s.toAddress ?? op.targetChain?.to ?? ''

  const instructionsPayload = {
    standardizedProperties: s,
    rawPayload: op.content?.payload,
    sourceChain: op.sourceChain,
    targetChain: op.targetChain,
    data: op.data,
    vaa: op.vaa,
  }

  return {
    correlation_id: op.id,
    status: toStatus(op),
    type,
    origin_protocol: protocol,
    destination_protocol: protocol,
    origin: chainIdToUrn(s.fromChain),
    destination: chainIdToUrn(s.toChain),
    from: addressToHex(from),
    to: addressToHex(to),
    from_formatted: from,
    to_formatted: to,
    sent_at: toUTCMillis(op.sourceChain?.timestamp),
    recv_at: op.targetChain ? toUTCMillis(op.targetChain.timestamp) : undefined,
    created_at: Date.now(),
    stops: asJSON(toWormholeStops(op)),
    instructions: asJSON([instructionsPayload]),
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

  return [
    {
      type: 'wormhole',

      from: {
        chainId: chainIdToUrn(s.fromChain),
        timestamp: toUTCMillis(op.sourceChain?.timestamp),
        status: op.sourceChain?.status ?? 'unknown',
        tx: op.sourceChain?.transaction,
      },

      to: op.targetChain
        ? {
            chainId: chainIdToUrn(s.toChain),
            timestamp: toUTCMillis(op.targetChain?.timestamp),
            status: op.targetChain?.status ?? 'unknown',
            tx: op.targetChain?.transaction,
          }
        : {
            chainId: chainIdToUrn(s.toChain),
            status: 'pending',
          },

      relay:
        op.targetChain?.status === undefined
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
