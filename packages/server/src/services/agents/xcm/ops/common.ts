import { Observable, map, mergeMap } from 'rxjs'

import { createNetworkId, getChainId, getConsensus, isOnSameConsensus } from '@/services/config.js'
import { ApiContext, BlockEvent } from '@/services/networking/index.js'
import { HexString } from '@/services/subscriptions/types.js'
import { AnyJson, NetworkURN } from '@/services/types.js'
import { toHex } from 'polkadot-api/utils'
import { GenericXcmSent, Leg, XcmSent, XcmSentWithContext } from '../types.js'
import { getParaIdFromJunctions, getSendersFromEvent, networkIdFromMultiLocation } from './util.js'
import { raw, versionedXcmCodec } from './xcm-format.js'

type Stop = { networkId: NetworkURN; message?: any[] }

// eslint-disable-next-line complexity
function recursiveExtractStops(origin: NetworkURN, instructions: any[], stops: Stop[]) {
  for (const instruction of instructions) {
    let nextStop
    let message

    if (instruction.type === 'DepositReserveAsset') {
      const { dest, xcm } = instruction.value
      nextStop = dest
      message = xcm
    } else if (instruction.type === 'InitiateReserveWithdraw') {
      const { reserve, xcm } = instruction.value
      nextStop = reserve
      message = xcm
    } else if (instruction.type === 'InitiateTeleport') {
      const { dest, xcm } = instruction.value
      nextStop = dest
      message = xcm
    } else if (instruction.type === 'TransferReserveAsset') {
      const { dest, xcm } = instruction.value
      nextStop = dest
      message = xcm
    } else if (instruction.type === 'ExportMessage') {
      const { network, destination, xcm } = instruction.value
      const paraId = getParaIdFromJunctions(destination)
      if (paraId) {
        const consensus = network.toString().toLowerCase()
        const networkId = createNetworkId(consensus, paraId)
        stops.push({ networkId })
        recursiveExtractStops(networkId, xcm, stops)
      }
    }

    if (nextStop !== undefined && message !== undefined) {
      const networkId = networkIdFromMultiLocation(nextStop, origin)

      if (networkId) {
        stops.push({ networkId, message })
        recursiveExtractStops(networkId, message, stops)
      }
    }
  }

  return stops
}

function constructLegs(stops: Stop[], version: string, context: ApiContext) {
  const legs: Leg[] = []
  for (let i = 0; i < stops.length - 1; i++) {
    const { networkId: from } = stops[i]
    const { networkId: to, message } = stops[i + 1]
    let partialMessage

    if (message !== undefined) {
      const partialXcm = { type: version, value: message }
      partialMessage = toHex(versionedXcmCodec(context).enc(partialXcm))
    }

    const leg = {
      from,
      to,
      type: 'vmp',
      partialMessage,
    } as Leg

    if (getConsensus(from) === getConsensus(to)) {
      if (getChainId(from) !== '0' && getChainId(to) !== '0') {
        leg.relay = createNetworkId(from, '0')
        leg.type = 'hrmp'
      }
    } else {
      leg.type = 'bridge'
    }

    legs.push(leg)
  }

  if (legs.length === 1) {
    return legs
  }

  for (let i = 0; i < legs.length - 1; i++) {
    const leg1 = legs[i]
    const leg2 = legs[i + 1]
    if (isOnSameConsensus(leg1.from, leg2.to)) {
      leg1.type = 'hop'
    }
  }

  return legs
}

/**
 * Maps a XcmSentWithContext to a XcmSent message.
 * Sets the destination as the final stop after recursively extracting all stops from the XCM message,
 * constructs the legs for the message and constructs the waypoint context.
 *
 * @param id - The subscription ID
 * @param registry - The type registry
 * @param origin - The origin network URN
 */
export function mapXcmSent(id: string, context: ApiContext, origin: NetworkURN) {
  return (source: Observable<XcmSentWithContext>): Observable<XcmSent> =>
    source.pipe(
      map((message) => {
        const { instructions, recipient } = message
        const stops: Stop[] = [{ networkId: recipient }]
        const versionedXcm = raw.asVersionedXcm(instructions.bytes, context)
        recursiveExtractStops(origin, versionedXcm.instructions.value, stops)
        const legs = constructLegs(
          [{ networkId: origin }].concat(stops),
          versionedXcm.instructions.type,
          context,
        )
        return new GenericXcmSent(id, origin, message, legs)
      }),
    )
}

export function xcmMessagesSent() {
  return (source: Observable<BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      mergeMap(async (event) => {
        const xcmMessage = event.value as { message_hash: HexString; message_id?: HexString }
        return {
          event: event as AnyJson,
          sender: await getSendersFromEvent(event),
          blockHash: event.blockHash as HexString,
          blockNumber: event.blockNumber,
          timestamp: event.timestamp,
          extrinsicPosition: event.extrinsicPosition,
          messageHash: xcmMessage.message_hash ?? xcmMessage.message_id,
          messageId: xcmMessage.message_id,
          extrinsicHash: event.extrinsic?.hash as HexString,
        } as XcmSentWithContext
      }),
    )
  }
}
