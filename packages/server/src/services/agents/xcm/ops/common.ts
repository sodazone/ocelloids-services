import { Observable, bufferCount, map, mergeMap } from 'rxjs'

import { filterNonNull } from '@/common/index.js'
import { createNetworkId, getChainId, getConsensus, isOnSameConsensus } from '@/services/config.js'
import { getTimestampFromBlock } from '@/services/networking/substrate/index.js'
import {
  Block,
  BlockContext,
  BlockEvent,
  Event,
  EventRecord,
  SubstrateApiContext,
} from '@/services/networking/substrate/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { AnyJson, NetworkURN } from '@/services/types.js'
import { toHex } from 'polkadot-api/utils'
import {
  AssetSwap,
  AssetsTrapped,
  GenericXcmInboundWithContext,
  GenericXcmSent,
  Leg,
  XcmInbound,
  XcmInboundWithContext,
  XcmSent,
  XcmSentWithContext,
} from '../types/index.js'
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

const swapMapping: Record<
  NetworkURN,
  { match: (event: Event) => boolean; transform: (event: BlockEvent) => AssetSwap }
> = {
  'urn:ocn:polkadot:1000': {
    match: (event: Event) => matchEvent(event, 'AssetConversion', 'SwapCreditExecuted'),
    transform: (event: BlockEvent): AssetSwap => {
      const { amount_in, amount_out, path } = event.value
      return {
        assetIn: {
          amount: amount_in,
          localAssetId: path[0][0],
        },
        assetOut: {
          amount: amount_out,
          localAssetId: path[path.length - 1][0],
        },
        event,
      } as AssetSwap
    },
  },
  'urn:ocn:polkadot:2034': {
    match: (event: Event) => matchEvent(event, 'Router', 'Executed'),
    transform: (event: BlockEvent): AssetSwap => {
      const { amount_in, amount_out, asset_in, asset_out } = event.value
      return {
        assetIn: {
          amount: amount_in,
          localAssetId: asset_in,
        },
        assetOut: {
          amount: amount_out,
          localAssetId: asset_out,
        },
        event,
      } as AssetSwap
    },
  },
}

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
        const consensus =
          typeof network === 'object' && 'type' in network
            ? network.type.toLowerCase()
            : network.toString().toLowerCase()
        const networkId = createNetworkId(consensus, paraId)
        stops.push({ networkId })
        recursiveExtractStops(networkId, xcm, stops)
      }
    } else if (instruction.type === 'InitiateTransfer') {
      const { destination, remote_xcm } = instruction.value
      nextStop = destination
      message = remote_xcm
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

function constructLegs(stops: Stop[], version: string, context: SubstrateApiContext) {
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
    } else if (getChainId(from) === '1000' && (to === 'urn:ocn:ethereum:1' || getChainId(from) === '1000')) {
      // TODO: Pending Snowbridge bridge support
      // Since we don't support bridges yet, all bridged transfers through assethub should end in bridgehub
      leg.to = `urn:ocn:${getConsensus(from)}:1002`
      leg.relay = createNetworkId(from, '0')
      leg.type = 'hrmp'
    } else if (getChainId(from) === '1002') {
      // P<>K bridge
      const prev = legs[legs.length - 1]
      prev.type = 'hop'
      legs.push({
        from,
        to: `urn:ocn:${getConsensus(to)}:1002`,
        type: 'bridge',
      })
      leg.from = `urn:ocn:${getConsensus(to)}:1002`
      if (getChainId(to) !== '0') {
        leg.relay = createNetworkId(to, '0')
        leg.type = 'hrmp'
      }
    } else {
      throw new Error(`Unknown leg type for origin=${from} destination=${to}`)
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
export function mapXcmSent(context: SubstrateApiContext, origin: NetworkURN) {
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
          specVersion: event.specVersion,
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
            specVersion: maybeXcmpEvent.specVersion,
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
            specVersion: maybeXcmpEvent.specVersion,
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
            specVersion: maybeXcmpEvent.specVersion,
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

function extractAssetContext({
  chainId,
  prevEvents,
  phase,
  blockNumber,
  blockHash,
  specVersion,
  timestamp,
}: {
  chainId: NetworkURN
  prevEvents: (EventRecord<Event> & { index: number })[]
  phase: string
  blockNumber: number
  blockHash: string
  specVersion?: number
  timestamp?: number
}): {
  assetsTrapped?: AssetsTrapped
  assetSwaps: AssetSwap[]
} {
  const maybeAssetTrapEvent: BlockEvent = toBlockEvent(prevEvents[prevEvents.length - 1].event, {
    blockNumber,
    blockHash,
    blockPosition: prevEvents[prevEvents.length - 1].index,
    specVersion,
    timestamp,
  })

  const assetTrapEvent = matchEvent(maybeAssetTrapEvent, ['XcmPallet', 'PolkadotXcm'], 'AssetsTrapped')
    ? maybeAssetTrapEvent
    : undefined

  const assetsTrapped = mapAssetsTrapped(assetTrapEvent)

  let assetSwaps: AssetSwap[] = []
  const mapping = swapMapping[chainId]
  if (mapping) {
    assetSwaps = [...prevEvents]
      .reverse()
      .filter(({ phase: p, event }) => p.type === phase && mapping.match(event))
      .map((record) =>
        mapping.transform(
          toBlockEvent(record.event, {
            blockNumber,
            blockHash,
            blockPosition: record.index,
            timestamp,
            specVersion,
          }),
        ),
      )
  }

  return { assetsTrapped, assetSwaps }
}

export function extractParachainReceiveByBlock(chainId: NetworkURN) {
  return (source: Observable<Block>): Observable<XcmInboundWithContext> => {
    return source.pipe(
      mergeMap(({ hash: blockHash, number: blockNumber, extrinsics, events, specVersion }) => {
        let pointer = 0
        const timestamp = getTimestampFromBlock(extrinsics)
        const recordsWithIndex = events.map((record, index) => ({ ...record, index }))
        const parachainReceived: XcmInboundWithContext[] = []
        for (const [i, { phase, event }] of events.entries()) {
          if (matchEvent(event, 'XcmpQueue', METHODS_XCMP_QUEUE)) {
            const xcmpQueueData = event.value
            const prevEvents = recordsWithIndex.slice(pointer, i)
            const { assetsTrapped, assetSwaps } = extractAssetContext({
              chainId,
              prevEvents,
              phase: phase.type,
              blockNumber,
              blockHash,
              specVersion,
              timestamp,
            })

            pointer = i
            parachainReceived.push(
              new GenericXcmInboundWithContext({
                event: toBlockEvent(event, { blockHash, blockNumber, blockPosition: i, timestamp }),
                blockHash: blockHash as HexString,
                blockNumber,
                specVersion,
                timestamp,
                messageHash: xcmpQueueData.message_hash,
                messageId: xcmpQueueData.message_id,
                outcome: event.name === 'Success' ? 'Success' : 'Fail',
                error: xcmpQueueData.error,
                assetsTrapped,
                assetSwaps,
              }),
            )
          } else if (matchEvent(event, 'MessageQueue', 'Processed')) {
            const { id, success, error } = event.value
            // Received event only emits field `message_id`,
            // which is actually the message hash in chains that do not yet support Topic ID.
            const messageId = id
            const messageHash = messageId

            const prevEvents = recordsWithIndex.slice(pointer, i)
            const { assetsTrapped, assetSwaps } = extractAssetContext({
              chainId,
              prevEvents,
              phase: phase.type,
              blockNumber,
              blockHash,
              specVersion,
              timestamp,
            })
            pointer = i

            parachainReceived.push(
              new GenericXcmInboundWithContext({
                event: toBlockEvent(event, {
                  blockHash,
                  blockNumber,
                  blockPosition: i,
                  timestamp,
                  specVersion,
                }),
                blockHash: blockHash as HexString,
                blockNumber,
                specVersion,
                timestamp,
                messageHash,
                messageId,
                outcome: success ? 'Success' : 'Fail',
                error,
                assetsTrapped,
                assetSwaps,
              }),
            )
          } else if (matchEvent(event, 'DmpQueue', 'ExecutedDownward')) {
            const { message_id, outcome } = event.value

            // Received event only emits field `message_id`,
            // which is actually the message hash in chains that do not yet support Topic ID.
            const messageId = message_id
            const messageHash = messageId

            const prevEvents = recordsWithIndex.slice(pointer, i)
            const { assetsTrapped, assetSwaps } = extractAssetContext({
              chainId,
              prevEvents,
              phase: phase.type,
              blockNumber,
              blockHash,
              specVersion,
              timestamp,
            })
            pointer = i

            parachainReceived.push(
              new GenericXcmInboundWithContext({
                event: toBlockEvent(event, {
                  blockHash,
                  blockNumber,
                  blockPosition: i,
                  timestamp,
                  specVersion,
                }),
                blockHash: blockHash as HexString,
                blockNumber,
                timestamp,
                specVersion,
                messageHash,
                messageId,
                outcome: outcome.type === 'Complete' ? 'Success' : 'Fail',
                error: null,
                assetsTrapped,
                assetSwaps,
              }),
            )
          }
        }
        return parachainReceived
      }),
    )
  }
}

function toBlockEvent(
  event: Event,
  { blockHash, blockNumber, blockPosition, timestamp, specVersion }: BlockContext,
): BlockEvent {
  return {
    ...event,
    blockNumber,
    blockHash,
    blockPosition,
    specVersion,
    timestamp,
  }
}
