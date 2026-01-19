import { Twox256 } from '@polkadot-api/substrate-bindings'
import { toHex } from 'polkadot-api/utils'

import { asJSON, deepCamelize, stringToUa8 } from '@/common/util.js'
import {
  calculateTotalUsd,
  FullJourney,
  NewAssetOperation,
  NewJourney,
} from '@/services/agents/crosschain/index.js'
import { HumanizedXcmAsset } from '@/services/agents/xcm/humanize/types.js'
import { BlockEvent } from '@/services/networking/substrate/index.js'
import { HexString } from '@/services/subscriptions/types.js'
import { AnyJson } from '@/services/types.js'

import { HumanizedXcmPayload, isXcmBridge, legTypes, XcmMessagePayload } from '../types/messages.js'

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

type XcmStopInstructions = {
  messageHash: HexString
  messageId?: HexString
  program: AnyJson
  executedAt?: {
    chainId: string
    event?: AnyJson
    outcome?: 'Success' | 'Fail'
  }
}

// waypoints on 2nd hop legs do not hold the XCM hash, topicId and program
// so we need to hold them in this "cache" when the destination contet is received before origin context
const executionContexts = new Map<
  string,
  {
    chainId: string
    event?: AnyJson
    outcome?: 'Success' | 'Fail'
  }
>()

function removeOldExecutionContexts() {
  while (executionContexts.size > 50) {
    const first = executionContexts.keys().next().value
    if (first) {
      executionContexts.delete(first)
    }
  }
}

export function toStops(payload: XcmMessagePayload | HumanizedXcmPayload, existingStops: any[] = []): any[] {
  const existingXcmStops = existingStops.filter((s) => legTypes.includes(s.type))

  const builtXcmStops = payload.legs.map((leg, index) => {
    const existingStop = existingXcmStops[index]
    if (payload.destinationProtocol === 'snowbridge' || payload.originProtocol === 'snowbridge') {
      console.log('SNOW existing stop', index, existingStop)
    }

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
            blockPosition: waypoint.txPosition,
            hash: waypoint.txHash,
            module: extrinsic?.module,
            method: extrinsic?.method,
            evmTxHash: extrinsic?.evmTxHash,
          },
          event: {
            blockPosition: event?.blockPosition,
            module: event?.module,
            name: event?.name,
          },
          bridge: isXcmBridge(payload)
            ? {
                channelId: payload.channelId,
                nonce: payload.nonce,
                bridgeName: payload.bridgeName,
              }
            : undefined,
          assetsTrapped: waypoint.assetsTrapped,
        }
      : null

    if (existingStop) {
      if (waypoint) {
        let instructions: XcmStopInstructions[]

        if (Array.isArray(existingStop.instructions)) {
          instructions = existingStop.instructions
        } else if (existingStop.instructions) {
          instructions = [existingStop.instructions]
          existingStop.instructions = instructions
        } else {
          instructions = []
          existingStop.instructions = instructions
        }

        // if the stop is a hop on second leg or more, the messageHash will not match
        // so just find the first one that needs execution updated
        // only xcms that have >1 instruction per leg is Hyddration → MRL, which has only 1 legs so is not an issue
        const existingInstruction =
          existingStop.type === 'hop' && index > 0
            ? instructions.find((i) => i.executedAt === undefined)
            : instructions.find((i) => i.messageHash === waypoint.messageHash)
        if (payload.destinationProtocol === 'snowbridge' || payload.originProtocol === 'snowbridge') {
          console.log('SNOW existing instruction', existingInstruction)
        }
        if (existingStop.from.chainId === waypoint.chainId) {
          existingStop.from = { ...existingStop.from, ...context }
          if (existingInstruction === undefined) {
            const newStopInstruction: XcmStopInstructions = {
              messageHash: waypoint.messageHash,
              messageId: waypoint.messageId ?? payload.messageId,
              program: waypoint.instructions,
            }
            const executionContextKey = `${toCorrelationId(payload)}:${index}:${existingStop.to.chainId}`
            const executionContext = executionContexts.get(executionContextKey)
            if (executionContext) {
              newStopInstruction.executedAt = executionContext
              executionContexts.delete(executionContextKey)
            }
            instructions.push(newStopInstruction)
          }
        } else if (existingStop.to.chainId === waypoint.chainId) {
          existingStop.to = { ...existingStop.to, ...context }
          if (existingInstruction) {
            existingInstruction.executedAt = {
              chainId: waypoint.chainId,
              event: context?.event,
              outcome: context?.status,
            }
          } else {
            executionContexts.set(`${toCorrelationId(payload)}:${index}:${waypoint.chainId}`, {
              chainId: waypoint.chainId,
              event: context?.event,
              outcome: context?.status,
            })
            removeOldExecutionContexts()
          }
        } else if (existingStop.relay?.chainId === waypoint.chainId) {
          existingStop.relay = { ...existingStop.relay, ...context }
        }
      }
      return existingStop
    }

    const isOutbound = leg.from === waypoint?.chainId
    return {
      type: leg.type,
      from: isOutbound ? context : { chainId: leg.from },
      to: leg.to === waypoint?.chainId ? context : { chainId: leg.to },
      relay: leg.relay === waypoint?.chainId ? context : leg.relay ? { chainId: leg.relay } : null,
      instructions:
        isOutbound && waypoint
          ? [
              {
                messageHash: waypoint.messageHash,
                messageId: waypoint.messageId ?? payload.messageId,
                program: waypoint.instructions,
              },
            ]
          : [],
    }
  })

  let xcmIndex = 0
  let lastXcmIndex = -1

  const merged = existingStops.map((stop, index) => {
    if (legTypes.includes(stop.type)) {
      lastXcmIndex = index
      return builtXcmStops[xcmIndex++] ?? stop
    }
    return stop
  })

  // Insert any remaining new XCM stops
  if (xcmIndex < builtXcmStops.length) {
    const insertionIndex = lastXcmIndex >= 0 ? lastXcmIndex + 1 : 0
    merged.splice(insertionIndex, 0, ...builtXcmStops.slice(xcmIndex))
  }

  const xprotocolData = 'humanized' in payload ? payload.humanized.xprotocolData : undefined
  if (xprotocolData) {
    const fromChainId = payload.destination.chainId
    const toChainId = xprotocolData.destination

    const alreadyExists = merged.some(
      (stop) => stop.from?.chainId === fromChainId && stop.to?.chainId === toChainId,
    )

    if (!alreadyExists) {
      merged.push({
        type: xprotocolData.type,
        from: { chainId: fromChainId },
        to: { chainId: toChainId },
      })
    }
  }

  return merged
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

export function toNewJourney(payload: HumanizedXcmPayload, tripId?: string): NewJourney {
  const xprotocolData = payload.humanized.xprotocolData
  const finalDestination = xprotocolData ? xprotocolData.destination : payload.destination.chainId
  const finalBeneficiary = xprotocolData ? xprotocolData.beneficiary : payload.humanized.to
  const destinationProtocol = xprotocolData ? xprotocolData.protocol : payload.destinationProtocol
  const type = xprotocolData && xprotocolData.assets.length > 0 ? 'transfer' : payload.humanized.type

  return {
    trip_id: tripId,
    correlation_id: toCorrelationId(payload),
    created_at: Date.now(),
    type,
    destination: finalDestination,
    instructions: payload.origin.instructions ? asJSON(payload.origin.instructions) : '[]',
    transact_calls: asJSON(payload.humanized.transactCalls),
    origin_protocol: payload.originProtocol,
    destination_protocol: destinationProtocol,
    origin: payload.origin.chainId,
    origin_tx_primary: payload.origin.txHash,
    origin_tx_secondary: toEvmTxHash(payload),
    from: payload.humanized.from.key,
    to: finalBeneficiary.key,
    from_formatted: payload.humanized.from.formatted,
    to_formatted: finalBeneficiary.formatted,
    sent_at: payload.origin.timestamp,
    status: toStatus(payload),
    stops: asJSON(toStops(payload)),
  }
}

export function toNewAssets(payload: HumanizedXcmPayload): Omit<NewAssetOperation, 'journey_id'>[] {
  const humanizedAssets = payload.humanized.assets ?? []
  const xprotocolAssets = payload.humanized.xprotocolData?.assets ?? []

  const assetMap = new Map<string, HumanizedXcmAsset>()

  const dedupeKey = (asset: HumanizedXcmAsset) => `${asset.id}:${asset.amount.toString()}`

  for (const asset of humanizedAssets) {
    assetMap.set(dedupeKey(asset), { ...asset })
  }

  for (const asset of xprotocolAssets) {
    const key = dedupeKey(asset)
    if (!assetMap.has(key)) {
      assetMap.set(key, { ...asset })
    }
  }

  const mergedAssets = Array.from(assetMap.values()).map((asset, index) => ({
    ...asset,
    sequence: index,
  }))

  return mergedAssets.map((asset) => ({
    symbol: asset.symbol,
    amount: asset.amount.toString(),
    asset: asset.id,
    decimals: asset.decimals,
    usd: asset.volume,
    role: asset.role,
    sequence: asset.sequence,
  }))
}

export function toTrappedAssets(assets: HumanizedXcmAsset[]): Omit<NewAssetOperation, 'journey_id'>[] {
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
