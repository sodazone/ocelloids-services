import { JourneyStatus, NewAssetOperation, NewJourney } from '@/services/agents/crosschain/index.js'
import { toUTCMillis } from '@/services/archive/time.js'
import { addressToHex } from '@/services/networking/apis/wormhole/address.js'
import { chainIdToUrn } from '@/services/networking/apis/wormhole/consts.js'
import {
  WormholeAction,
  WormholeOperation,
  WormholeProtocol,
} from '@/services/networking/apis/wormhole/types.js'

export function toStatus(op: WormholeOperation): JourneyStatus {
  if (op.targetChain?.status === 'completed') {
    return 'received'
  }
  if (['in_progress', 'confirmed'].includes(op.sourceChain.status)) {
    return 'sent'
  }
  return 'unknown'
}

// TODO: handle errors
export function defaultJourneyMapping(
  op: WormholeOperation,
  type: WormholeAction,
  protocol: WormholeProtocol,
): NewJourney {
  const s = op.content.standarizedProperties
  const from = op.sourceChain.from ?? s.fromAddress
  const to = s.toAddress ?? op.targetChain?.to ?? ''

  const instructionsPayload = {
    standardizedProperties: s,
    rawPayload: op.content.payload,
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
    sent_at: toUTCMillis(op.sourceChain.timestamp),
    recv_at: op.targetChain ? toUTCMillis(op.targetChain.timestamp) : undefined,
    created_at: Date.now(),
    stops: JSON.stringify(toWormholeStops(op)),
    instructions: JSON.stringify(instructionsPayload),
    transact_calls: '[]',
    origin_tx_primary: op.sourceChain.transaction.txHash,
    origin_tx_secondary: op.sourceChain.transaction.secondTxHash,
    destination_tx_primary: op.targetChain?.transaction.txHash,
    destination_tx_secondary: op.targetChain?.transaction.secondTxHash,
  }
}

export function defaultAssetMapping(op: WormholeOperation, journey: NewJourney): NewAssetOperation[] {
  const s = op.content.standarizedProperties

  if (s.tokenAddress === '') {
    journey.type = 'unknown'
    return []
  }

  return [
    {
      journey_id: -1,
      asset: s.tokenAddress,
      symbol: undefined,
      amount: s.amount,
      decimals: s.normalizedDecimals ?? 0,
      usd: undefined,
      role: 'transfer',
      sequence: 0,
    },
  ]
}

/**
 * Normalize Wormhole operations into a stop-style journey model
 */
export function toWormholeStops(payload: WormholeOperation, existingStops: any[] = []): any[] {
  const s = payload.content.standarizedProperties
  const fromAddr = s.fromAddress || payload.sourceChain.from
  const toAddr = s.toAddress || (payload.targetChain?.to ?? '')

  // derive a single "stop" context for origin / destination
  const originContext = {
    chainId: s.fromChain,
    urn: chainIdToUrn(s.fromChain),
    address: addressToHex(fromAddr),
    formatted: fromAddr,
    txHash: payload.sourceChain.transaction.txHash,
    secondTxHash: payload.sourceChain.transaction.secondTxHash,
    // TODO
    // blockNumber: payload.sourceChain.blockNumber,
    timestamp: toUTCMillis(payload.sourceChain.timestamp),
  }

  const destinationContext = payload.targetChain
    ? {
        chainId: s.toChain,
        urn: chainIdToUrn(s.toChain),
        address: addressToHex(toAddr),
        formatted: toAddr,
        txHash: payload.targetChain.transaction.txHash,
        secondTxHash: payload.targetChain.transaction.secondTxHash,
        // TODO
        //blockNumber: payload.targetChain.blockNumber,
        timestamp: toUTCMillis(payload.targetChain.timestamp),
      }
    : null

  const newStop = {
    type: 'transfer',
    from: originContext,
    to: destinationContext ? destinationContext : { chainId: s.toChain },
    relay: null, // wormhole doesn’t have relay legs like XCM
    messageId: payload.id,
    status: payload.targetChain ? 'received' : 'sent',
    instructions: [],
    transact_calls: [],
  }

  // merge with existingStops if already present
  const existing = existingStops.find((stop) => stop.from.chainId === originContext.chainId)
  if (existing) {
    return existingStops.map((stop) =>
      stop.from.chainId === originContext.chainId ? { ...stop, ...newStop } : stop,
    )
  } else {
    return [...existingStops, newStop]
  }
}
