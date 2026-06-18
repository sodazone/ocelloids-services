import { Twox256 } from '@polkadot-api/substrate-bindings'
import { toHex } from 'polkadot-api/utils'
import { asJSON, stringToUa8 } from '@/common/util.js'
import { networks } from '../common/networks.js'
import { NewJourney } from '../crosschain/index.js'
import {
  BasejumpMessagePayload,
  BasejumpMessagePayloadWithMetadata,
  BasejumpPending,
  isBasejumpProcessed,
} from './types.js'

type BasejumpStops = {
  type: string
  from: Record<string, any>
  to: Record<string, any>
  relay?: Record<string, any>
  messageId?: string
  queueId?: string
  instructions: any
}

const WORMHOLE = 'urn:ocn:wormhole:1'

export function toUniqueCorrelationId(payload: BasejumpMessagePayload | BasejumpMessagePayloadWithMetadata) {
  return toHex(
    Twox256(
      stringToUa8(
        `${payload.matchingKey}${payload.origin.chainId}${payload.origin.blockNumber}${payload.origin.txHash ?? '0x'}${payload.destination.chainId}`,
      ),
    ),
  )
}

export function toStatus(payload: BasejumpMessagePayloadWithMetadata) {
  if (
    (payload.type === 'basejump.executed' || payload.type === 'basejump.fulfilled') &&
    'outcome' in payload.destination
  ) {
    return payload.destination.outcome === 'Success' ? 'received' : 'failed'
  }
  if (payload.waypoint.outcome === 'Fail') {
    return 'failed'
  }
  if (payload.type === 'basejump.unmatched') {
    return 'timeout'
  }
  if (payload.type === 'basejump.queued') {
    return 'waiting'
  }
  if (['basejump.initiated', 'basejump.processed'].includes(payload.type)) {
    return 'sent'
  }
  return 'unknown'
}

export function toNewJourney(correlationId: string, payload: BasejumpMessagePayloadWithMetadata): NewJourney {
  return {
    correlation_id: correlationId,
    created_at: Date.now(),
    type: 'transfer',
    destination: payload.destination.chainId,
    instructions: '[]',
    transact_calls: '[]',
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
    stops: asJSON(toBasejumpStops(payload)),
  }
}

export function toBasejumpStops(
  payload: BasejumpMessagePayloadWithMetadata,
  existingStops?: BasejumpStops[],
): BasejumpStops[] {
  const { origin, waypoint, destination, vaaId, type } = payload

  const isToHydration = destination.chainId === networks.hydration

  const context = {
    chainId: waypoint.chainId,
    blockHash: waypoint.blockHash,
    blockNumber: waypoint.blockNumber,
    timestamp: waypoint.timestamp,
    status: waypoint.outcome,
    tx: {
      txHash: waypoint.txHash,
      txHashSecondary: waypoint.txHashSecondary,
    },
  }

  const whInstructions = isBasejumpProcessed(payload)
    ? {
        type: 'WormholeVAA',
        value: {
          raw: payload.payload,
          guardiantSetIndex: payload.guardianSet,
        },
      }
    : {}

  function createStops(): BasejumpStops[] {
    if (isToHydration) {
      return [
        {
          type: 'wormhole',
          from: { chainId: origin.chainId },
          to: { chainId: networks.moonbeam },
          relay: vaaId
            ? {
                chainId: WORMHOLE,
                status: 'pending',
                vaaId,
              }
            : undefined,
          messageId: vaaId,
          instructions: whInstructions,
        },
        {
          type: 'hrmp',
          from: { chainId: networks.moonbeam },
          to: { chainId: networks.hydration },
          instructions: {},
        },
      ]
    }

    return [
      {
        type: 'hrmp',
        from: { chainId: networks.hydration },
        to: { chainId: networks.moonbeam },
        instructions: {},
      },
      {
        type: 'wormhole',
        from: { chainId: networks.moonbeam },
        to: { chainId: destination.chainId },
        relay: vaaId
          ? {
              chainId: WORMHOLE,
              status: 'pending',
              vaaId,
            }
          : undefined,
        messageId: vaaId,
        instructions: whInstructions,
      },
    ]
  }

  if (!existingStops?.length) {
    const stops = createStops()

    if (type === 'basejump.initiated') {
      stops[0].from = context
      if (vaaId) {
        stops[0].messageId = vaaId
      }
    }

    return stops
  }

  const stops = existingStops

  const wormholeLegIndex = isToHydration ? 0 : 1
  const wormholeLeg = stops[wormholeLegIndex]

  switch (type) {
    case 'basejump.initiated': {
      stops[0].from = context
      break
    }

    case 'basejump.processed': {
      const leg = wormholeLeg
      leg.to = context
      leg.relay = leg.relay
        ? {
            ...leg.relay,
            status: 'completed',
            vaaId,
          }
        : {
            chainId: WORMHOLE,
            status: 'completed',
            vaaId,
          }
      leg.messageId = vaaId
      leg.instructions = whInstructions
      break
    }

    case 'basejump.executed': {
      stops[1].to = context
      break
    }

    case 'basejump.queued': {
      stops[1].to = { ...context, status: 'waiting' }
      stops[1].queueId = (payload as BasejumpPending).id
      break
    }

    case 'basejump.fulfilled': {
      stops[1].to = context
      break
    }
  }

  return stops
}
