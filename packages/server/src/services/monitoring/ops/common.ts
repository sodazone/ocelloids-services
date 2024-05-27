import { Observable, map } from 'rxjs'

import type { XcmV2Xcm, XcmV3Xcm } from '@polkadot/types/lookup'
import type { Registry } from '@polkadot/types/types'

import { types } from '@sodazone/ocelloids-sdk'
import { createNetworkId, getChainId, getConsensus } from '../../config.js'
import { NetworkURN } from '../../types.js'
import { AnyJson, GenericXcmSent, Leg, XcmSent, XcmSentWithContext } from '../types.js'
import { getSendersFromEvent, networkIdFromMultiLocation } from './util.js'
import { asVersionedXcm } from './xcm-format.js'
import { XcmV4Xcm } from './xcm-types.js'

// eslint-disable-next-line complexity
function recursiveExtractStops(origin: NetworkURN, instructions: XcmV2Xcm | XcmV3Xcm | XcmV4Xcm, stops: NetworkURN[]) {
  for (const instruction of instructions) {
    let nextStop
    let message

    if (instruction.isDepositReserveAsset) {
      const { dest, xcm } = instruction.asDepositReserveAsset
      nextStop = dest
      message = xcm
    } else if (instruction.isInitiateReserveWithdraw) {
      const { reserve, xcm } = instruction.asInitiateReserveWithdraw
      nextStop = reserve
      message = xcm
    } else if (instruction.isInitiateTeleport) {
      const { dest, xcm } = instruction.asInitiateTeleport
      nextStop = dest
      message = xcm
    } else if (instruction.isTransferReserveAsset) {
      const { dest, xcm } = instruction.asTransferReserveAsset
      nextStop = dest
      message = xcm
    }
    // TODO: support ExportMessage for bridges

    if (nextStop !== undefined && message !== undefined) {
      const networkId = networkIdFromMultiLocation(nextStop, origin)

      if (networkId) {
        stops.push(networkId)
        recursiveExtractStops(networkId, message, stops)
      }
    }
  }

  return stops
}

function constructLegs(origin: NetworkURN, stops: NetworkURN[]) {
  const legs: Leg[] = []
  const destination = stops[stops.length - 1]
  const nodes = [origin].concat(stops)
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodes[i]
    const to = nodes[i + 1]
    const leg = {
      from,
      to,
      type: 'vmp',
    } as Leg

    if (getConsensus(from) === getConsensus(to)) {
      if (getChainId(from) !== '0' && getChainId(to) !== '0') {
        leg.relay = createNetworkId(from, '0')
        leg.type = 'hrmp'
      }
      if (from !== origin || to !== destination) {
        leg.type = 'hop'
      }
    } else {
      leg.type = 'bridge'
    }

    legs.push(leg)
  }

  return legs
}

/**
 * Maps a XcmSentWithContext to a XcmSent message.
 * Sets the destination as the final stop after recursively extracting all stops from the XCM message,
 * constructs the legs for the message and constructs the waypoint context.
 *
 * @param id subscription ID
 * @param registry type registry
 * @param origin origin network URN
 * @returns Observable<XcmSent>
 */
export function mapXcmSent(id: string, registry: Registry, origin: NetworkURN) {
  return (source: Observable<XcmSentWithContext>): Observable<XcmSent> =>
    source.pipe(
      map((message) => {
        const { instructions, recipient } = message
        const stops: NetworkURN[] = [recipient]
        const versionedXcm = asVersionedXcm(instructions.bytes, registry)
        recursiveExtractStops(origin, versionedXcm[`as${versionedXcm.type}`], stops)
        const legs = constructLegs(origin, stops)
        return new GenericXcmSent(id, origin, message, legs)
      })
    )
}

export function blockEventToHuman(event: types.BlockEvent): AnyJson {
  return {
    extrinsicPosition: event.extrinsicPosition,
    extrinsicId: event.extrinsicId,
    blockNumber: event.blockNumber.toNumber(),
    blockHash: event.blockHash.toHex(),
    blockPosition: event.blockPosition,
    eventId: event.eventId,
    data: event.data.toHuman(),
    index: event.index.toHuman(),
    meta: event.meta.toHuman(),
    method: event.method,
    section: event.section,
  } as AnyJson
}

export function xcmMessagesSent() {
  return (source: Observable<types.BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      map((event) => {
        const xcmMessage = event.data as any
        return {
          event: blockEventToHuman(event),
          sender: getSendersFromEvent(event),
          blockHash: event.blockHash.toHex(),
          blockNumber: event.blockNumber.toPrimitive(),
          extrinsicId: event.extrinsicId,
          messageHash: xcmMessage.messageHash?.toHex(),
          messageId: xcmMessage.messageId?.toHex(),
        } as XcmSentWithContext
      })
    )
  }
}
