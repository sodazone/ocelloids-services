import { Observable, bufferCount, map, mergeMap } from 'rxjs'

import { filterNonNull } from '@/common/index.js'
import { createNetworkId, getChainId, getConsensus, isOnSameConsensus } from '@/services/config.js'
import { ApiContext, BlockEvent } from '@/services/networking/index.js'
import { HexString } from '@/services/subscriptions/types.js'
import { AnyJson, NetworkURN } from '@/services/types.js'
import { toHex } from 'polkadot-api/utils'
import {
  GenericXcmInboundWithContext,
  GenericXcmSent,
  Leg,
  XcmInbound,
  XcmInboundWithContext,
  XcmSent,
  XcmSentWithContext,
} from '../types.js'
import {
  getParaIdFromJunctions,
  getSendersFromEvent,
  mapAssetsTrapped,
  matchEvent,
  networkIdFromMultiLocation,
} from './util.js'
import { raw, versionedXcmCodec } from './xcm-format.js'
import { METHODS_XCMP_QUEUE } from './xcmp.js'

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
 * @param registry - The type registry
 * @param origin - The origin network URN
 */
export function mapXcmSent(context: ApiContext, origin: NetworkURN) {
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
        return new GenericXcmSent(origin, message, legs)
      }),
    )
}

export function mapXcmInbound(chainId: NetworkURN) {
  return (source: Observable<XcmInboundWithContext>): Observable<XcmInbound> =>
    source.pipe(map((msg) => new XcmInbound(chainId, msg)))
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

/**
 * Extract XCM receive events for both DMP and HRMP in parachains.
 * Most parachains emit the same event, MessageQueue.Processed, for both DMP and HRMP.
 * But some, like Interlay, emits a different event DmpQueue.ExecutedDownward for DMP.
 */
export function extractParachainReceive() {
  return (source: Observable<BlockEvent>): Observable<XcmInboundWithContext> => {
    return source.pipe(
      bufferCount(2, 1),
      // eslint-disable-next-line complexity
      map(([maybeAssetTrapEvent, maybeXcmpEvent]) => {
        if (maybeXcmpEvent === undefined) {
          return null
        }

        const assetTrapEvent = matchEvent(maybeAssetTrapEvent, ['XcmPallet', 'PolkadotXcm'], 'AssetsTrapped')
          ? maybeAssetTrapEvent
          : undefined
        const assetsTrapped = mapAssetsTrapped(assetTrapEvent)

        if (matchEvent(maybeXcmpEvent, 'XcmpQueue', METHODS_XCMP_QUEUE)) {
          const xcmpQueueData = maybeXcmpEvent.value

          return new GenericXcmInboundWithContext({
            event: maybeXcmpEvent,
            extrinsicHash: maybeXcmpEvent.extrinsic?.hash as HexString,
            blockHash: maybeXcmpEvent.blockHash as HexString,
            blockNumber: maybeXcmpEvent.blockNumber,
            timestamp: maybeXcmpEvent.timestamp,
            extrinsicPosition: maybeXcmpEvent.extrinsicPosition,
            messageHash: xcmpQueueData.message_hash,
            messageId: xcmpQueueData.message_id,
            outcome: maybeXcmpEvent.name === 'Success' ? 'Success' : 'Fail',
            error: xcmpQueueData.error,
            assetsTrapped,
          })
        } else if (matchEvent(maybeXcmpEvent, 'MessageQueue', 'Processed')) {
          const { id, success, error } = maybeXcmpEvent.value
          // Received event only emits field `message_id`,
          // which is actually the message hash in chains that do not yet support Topic ID.
          const messageId = id
          const messageHash = messageId

          return new GenericXcmInboundWithContext({
            event: maybeXcmpEvent,
            extrinsicHash: maybeXcmpEvent.extrinsic?.hash as HexString,
            blockHash: maybeXcmpEvent.blockHash as HexString,
            blockNumber: maybeXcmpEvent.blockNumber,
            timestamp: maybeXcmpEvent.timestamp,
            messageHash,
            messageId,
            outcome: success ? 'Success' : 'Fail',
            error,
            assetsTrapped,
          })
        } else if (matchEvent(maybeXcmpEvent, 'DmpQueue', 'ExecutedDownward')) {
          const { message_id, outcome } = maybeXcmpEvent.value

          // Received event only emits field `message_id`,
          // which is actually the message hash in chains that do not yet support Topic ID.
          const messageId = message_id
          const messageHash = messageId

          return new GenericXcmInboundWithContext({
            event: maybeXcmpEvent,
            extrinsicHash: maybeXcmpEvent.extrinsic?.hash as HexString,
            blockHash: maybeXcmpEvent.blockHash as HexString,
            blockNumber: maybeXcmpEvent.blockNumber,
            timestamp: maybeXcmpEvent.timestamp,
            messageHash,
            messageId,
            outcome: outcome.type === 'Complete' ? 'Success' : 'Fail',
            error: null,
            assetsTrapped,
          })
        }

        return null
      }),
      filterNonNull(),
    )
  }
}
