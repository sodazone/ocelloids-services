import { Twox256 } from '@polkadot-api/substrate-bindings'
import { toHex } from 'polkadot-api/utils'

import { asJSON, deepCamelize, stringToUa8 } from '@/common/util.js'
import {
  calculateTotalUsd,
  FullJourney,
  NewAssetOperation,
  NewJourney,
} from '@/services/agents/crosschain/index.js'
import { BlockEvent } from '@/services/networking/substrate/index.js'

import { HumanizedXcmAsset, HumanizedXcmPayload, XcmMessagePayload } from '../lib.js'

export function toStatus(payload: XcmMessagePayload) {
  if ('outcome' in payload.destination) {
    return payload.destination.outcome === 'Success' ? 'received' : 'failed'
  }
  if (payload.waypoint.outcome === 'Fail') {
    return 'failed'
  }
  if (payload.type === 'xcm.timeout') {
    return 'timeout'
  }
  if (['xcm.sent', 'xcm.relayed', 'xcm.hop', 'xcm.bridge'].includes(payload.type)) {
    return 'sent'
  }
  return 'unknown'
}

export function asNewJourneyObject(
  newJourney: NewJourney,
  assets: Omit<NewAssetOperation, 'journey_id'>[],
  id: number,
) {
  return deepCamelize<FullJourney>({
    ...{
      ...newJourney,
      transactCalls: JSON.parse(newJourney.transact_calls),
      instructions: JSON.parse(newJourney.instructions),
      stops: JSON.parse(newJourney.stops),
    },
    assets,
    totalUsd: calculateTotalUsd(assets),
    id,
  })
}

export function toStops(payload: XcmMessagePayload, existingStops: any[] = []): any[] {
  const updatedStops = payload.legs.map((leg, index) => {
    const existingStop = existingStops[index]

    const waypoint = payload.waypoint.legIndex === index ? payload.waypoint : null
    const event = waypoint?.event ? (waypoint.event as any) : undefined
    const extrinsic = event ? (event.extrinsic as any) : undefined
    const context = waypoint
      ? {
          chainId: waypoint.chainId,
          blockHash: waypoint.blockHash,
          blockNumber: waypoint.blockNumber,
          timestamp: waypoint.timestamp,
          status: waypoint.outcome,
          extrinsic: {
            blockPosition: waypoint.extrinsicPosition,
            hash: waypoint.extrinsicHash,
            module: extrinsic?.module,
            method: extrinsic?.method,
            evmTxHash: extrinsic?.evmTxHash,
          },
          event: {
            blockPosition: event?.blockPosition,
            module: event?.module,
            name: event?.name,
          },
          assetsTrapped: waypoint.assetsTrapped,
        }
      : null

    if (existingStop) {
      // Update existing stop with waypoint context
      if (waypoint) {
        if (existingStop.from.chainId === waypoint.chainId) {
          existingStop.from = { ...existingStop.from, ...context }
          existingStop.messageHash = waypoint.messageHash
          existingStop.messageId = waypoint.messageId ?? payload.messageId
          existingStop.instructions = waypoint.instructions
        } else if (existingStop.to.chainId === waypoint.chainId) {
          existingStop.to = { ...existingStop.to, ...context }
        } else if (existingStop.relay?.chainId === waypoint.chainId) {
          existingStop.relay = { ...existingStop.relay, ...context }
        }
      }
      return existingStop
    } else {
      // Create a new stop if no existing stop is found
      const isOutbound = leg.from === waypoint?.chainId
      return {
        type: leg.type,
        from: isOutbound ? context : { chainId: leg.from },
        to: leg.to === waypoint?.chainId ? context : { chainId: leg.to },
        relay: leg.relay === waypoint?.chainId ? context : leg.relay ? { chainId: leg.relay } : null,
        messageHash: isOutbound ? waypoint.messageHash : undefined,
        messageId: isOutbound ? (waypoint.messageId ?? payload.messageId) : undefined,
        instructions: isOutbound ? waypoint.instructions : undefined,
      }
    }
  })

  return updatedStops
}

export function toCorrelationId(payload: XcmMessagePayload): string {
  const id = payload.messageId ?? payload.origin.messageHash

  return toHex(
    Twox256(
      stringToUa8(
        `${id}${payload.origin.chainId}${payload.origin.blockNumber}${payload.destination.chainId}`,
      ),
    ),
  )
}

function toEvmTxHash(payload: XcmMessagePayload): string | undefined {
  return (payload.origin.event as BlockEvent)?.extrinsic?.evmTxHash
}

export function toNewJourney(payload: HumanizedXcmPayload): NewJourney {
  return {
    correlation_id: toCorrelationId(payload),
    created_at: Date.now(),
    type: payload.humanized.type,
    destination: payload.destination.chainId,
    instructions: asJSON(payload.origin.instructions),
    transact_calls: asJSON(payload.humanized.transactCalls),
    origin_protocol: 'xcm',
    destination_protocol: 'xcm',
    origin: payload.origin.chainId,
    origin_tx_primary: payload.origin.extrinsicHash,
    origin_tx_secondary: toEvmTxHash(payload),
    from: payload.humanized.from.key,
    to: payload.humanized.to.key,
    from_formatted: payload.humanized.from.formatted,
    to_formatted: payload.humanized.to.formatted,
    sent_at: payload.origin.timestamp,
    status: toStatus(payload),
    stops: asJSON(toStops(payload)),
  }
}

export function toNewAssets(assets: HumanizedXcmAsset[]): Omit<NewAssetOperation, 'journey_id'>[] {
  return assets.map((asset) => ({
    symbol: asset.symbol,
    amount: asset.amount.toString(),
    asset: asset.id,
    decimals: asset.decimals,
    usd: asset.volume,
    role: asset.role,
    sequence: asset.sequence,
  }))
}
