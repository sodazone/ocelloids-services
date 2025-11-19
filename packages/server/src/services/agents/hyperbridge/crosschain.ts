import { asJSON } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { NewAssetOperation, NewJourney } from '../crosschain/index.js'
import { HYPERBRIDGE_NETWORK_ID } from './config.js'
import { HyperbridgeDecodedPayload } from './types.js'

type HyperbridgeStops = {
  type: 'ismp'
  from: Record<string, any>
  to: Record<string, any>
  relay: Record<string, any>
  messageId: HexString
  instructions: any
}

function toJourneyType(payload: HyperbridgeDecodedPayload) {
  if (payload.decoded === undefined) {
    return 'post'
  }

  return payload.decoded.type
}

export function toStatus(payload: HyperbridgeDecodedPayload) {
  if ('outcome' in payload.destination) {
    return payload.destination.outcome === 'Success' ? 'received' : 'failed'
  }
  if (payload.waypoint.outcome === 'Fail') {
    return 'failed'
  }
  if (payload.type === 'ismp.timeout') {
    return 'timeout'
  }
  if (payload.type === 'ismp.unmatched') {
    return 'timeout'
  }
  if (['ismp.dispatched', 'ismp.relayed'].includes(payload.type)) {
    return 'sent'
  }
  return 'unknown'
}

export function toHyperbridgeStops(
  { type, origin, destination, waypoint, commitment, decoded, relayer }: HyperbridgeDecodedPayload,
  existingStops?: HyperbridgeStops[],
): HyperbridgeStops[] {
  const context = {
    chainId: waypoint.chainId,
    blockHash: waypoint.blockHash,
    blockNumber: waypoint.blockNumber,
    timestamp: waypoint.timestamp,
    status: waypoint.outcome,
    tx: {
      blockPosition: waypoint.txPosition,
      hash: waypoint.txHash,
      hashSecondary: waypoint.txHashSecondary,
    },
    event: waypoint.event,
    relayer,
  }
  if (!existingStops || existingStops.length === 0) {
    return [
      {
        type: 'ismp',
        from: type === 'ismp.dispatched' ? context : { chainId: origin.chainId },
        to: type === 'ismp.received' ? context : { chainId: destination.chainId },
        relay: type === 'ismp.relayed' ? context : { chainId: HYPERBRIDGE_NETWORK_ID },
        messageId: commitment,
        instructions: decoded,
      },
    ]
  }

  switch (type) {
    case 'ismp.dispatched': {
      existingStops[0].from = context
      break
    }
    case 'ismp.received': {
      existingStops[0].to = context
      break
    }
    case 'ismp.relayed': {
      if ('blockNumber' in existingStops[0].relay && 'blockHash' in existingStops[0].relay) {
        existingStops[0].relay = {
          ...existingStops[0].relay,
          eventSecondary: waypoint.event,
        }
      } else {
        existingStops[0].relay = context
      }
      break
    }
    case 'ismp.timeout': {
      existingStops[0].from.timeout = context
      break
    }
    default: {
      // noop
      break
    }
  }

  return existingStops
}

export function toNewJourney(payload: HyperbridgeDecodedPayload): NewJourney {
  return {
    correlation_id: payload.commitment,
    created_at: Date.now(),
    type: toJourneyType(payload),
    destination: payload.destination.chainId,
    instructions: payload.decoded ? asJSON(payload.decoded) : '',
    transact_calls: payload.decoded?.type === 'transact' ? asJSON(payload.decoded) : '',
    origin_protocol: payload.originProtocol,
    destination_protocol: payload.destinationProtocol,
    origin: payload.origin.chainId,
    origin_tx_primary: payload.origin.txHash,
    origin_tx_secondary: payload.origin.txHashSecondary,
    from: payload.from.key,
    to: payload.to.key,
    from_formatted: payload.from.formatted,
    to_formatted: payload.to.formatted,
    sent_at: payload.origin.timestamp,
    status: toStatus(payload),
    stops: asJSON(toHyperbridgeStops(payload)),
  }
}

export function toNewAssets(payload: HyperbridgeDecodedPayload): Omit<NewAssetOperation, 'journey_id'>[] {
  if (payload.decoded === undefined || payload.decoded.type === 'transact') {
    return []
  }
  return [
    {
      asset: `${HYPERBRIDGE_NETWORK_ID}|${payload.decoded.assetId}`,
      symbol: payload.decoded.symbol,
      amount: payload.decoded.amount ?? '0',
      decimals: payload.decoded.decimals ?? 0,
      usd: payload.decoded.usd,
      role: 'transfer',
      sequence: 0,
    },
  ]
}
