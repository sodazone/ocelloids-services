import { Observable, map } from 'rxjs'

import { Binary, Blake2256 } from '@polkadot-api/substrate-bindings'

import { createNetworkId, getChainId, getConsensus, isOnSameConsensus } from '@/services/config.js'
import { ApiContext, BlockEvent } from '@/services/networking/index.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import { fromHex, mergeUint8, toHex } from 'polkadot-api/utils'
import { asSerializable } from '../../base/util.js'
import { GenericXcmSent, Leg, XcmSent, XcmSentWithContext } from '../types.js'
import {
  getBridgeHubNetworkId,
  getParaIdFromJunctions,
  getSendersFromEvent,
  networkIdFromMultiLocation,
} from './util.js'
import { asVersionedXcm } from './xcm-format.js'

// eslint-disable-next-line complexity
function recursiveExtractStops(origin: NetworkURN, instructions: any[], stops: NetworkURN[]) {
  console.log(instructions)
  for (const instruction of instructions) {
    let nextStop
    let message

    if (instruction.type === 'DepositReserveAsset') {
      const { dest, xcm } = instruction.value
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
    } else if (instruction.isExportMessage) {
      const { network, destination, xcm } = instruction.asExportMessage
      const paraId = getParaIdFromJunctions(destination)
      if (paraId) {
        const consensus = network.toString().toLowerCase()
        const networkId = createNetworkId(consensus, paraId)
        const bridgeHubNetworkId = getBridgeHubNetworkId(consensus)
        // We assume that an ExportMessage will always go through Bridge Hub
        if (bridgeHubNetworkId !== undefined && networkId !== bridgeHubNetworkId) {
          stops.push(bridgeHubNetworkId)
        }
        stops.push(networkId)
        recursiveExtractStops(networkId, xcm, stops)
      }
    }

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
      leg2.type = 'hop'
    }
  }

  if (legs.length === 1) {
    return legs
  }

  for (let i = 0; i < legs.length - 1; i++) {
    const leg1 = legs[i]
    const leg2 = legs[i + 1]
    if (isOnSameConsensus(leg1.from, leg2.to)) {
      leg1.type = 'hop'
      leg2.type = 'hop'
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
        const stops: NetworkURN[] = [recipient]
        const versionedXcm = asVersionedXcm(instructions.bytes, context)
        recursiveExtractStops(origin, versionedXcm.instructions.value, stops)
        const legs = constructLegs(origin, stops)

        let forwardId: HexString | undefined
        // TODO: extract to util?
        if (origin === getBridgeHubNetworkId(origin) && message.messageId !== undefined) {
          const constant = 'forward_id_for'
          const derivedIdBuf = mergeUint8(new TextEncoder().encode(constant), fromHex(message.messageId))
          forwardId = toHex(Blake2256(derivedIdBuf)) as HexString
        }
        return new GenericXcmSent(id, origin, message, legs, forwardId)
      }),
    )
}

export function xcmMessagesSent() {
  return (source: Observable<BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      map((event) => {
        const xcmMessage = event.value as { message_hash: Binary; message_id?: Binary }
        return {
          event: asSerializable(event),
          sender: getSendersFromEvent(event),
          blockHash: event.blockHash as HexString,
          blockNumber: event.blockNumber,
          timestamp: event.timestamp,
          extrinsicPosition: event.extrinsicPosition,
          messageHash: xcmMessage.message_hash?.asHex() ?? xcmMessage.message_id?.asHex(),
          messageId: xcmMessage.message_id?.asHex(),
        } as XcmSentWithContext
      }),
    )
  }
}
