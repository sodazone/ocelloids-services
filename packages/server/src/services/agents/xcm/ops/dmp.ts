import { Observable, bufferCount, map, mergeMap } from 'rxjs'

import { filterNonNull } from '@/common/index.js'
import { ApiContext, BlockEvent } from '@/services/networking/index.js'
import { HexString, SignerData } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'

import { GetDownwardMessageQueues } from '../types-augmented.js'
import {
  GenericXcmInboundWithContext,
  GenericXcmSentWithContext,
  XcmInboundWithContext,
  XcmSentWithContext,
} from '../types.js'
import {
  getMessageId,
  getSendersFromEvent,
  mapAssetsTrapped,
  matchEvent,
  matchProgramByTopic,
  networkIdFromMultiLocation,
} from './util.js'
import { Program, asVersionedXcm } from './xcm-format.js'

/*
 ==================================================================================
 NOTICE
 ==================================================================================

 This DMP message matching implementation is provisional and will be replaced
 as soon as possible.

 For details see: https://github.com/paritytech/polkadot-sdk/issues/1905
*/

type XcmContext = {
  recipient: NetworkURN
  data: Uint8Array
  program: Program
  blockHash: string
  blockNumber: number
  timestamp?: number
  sender?: SignerData
  event?: BlockEvent
}

function createXcmMessageSent({
  recipient,
  data,
  program,
  blockHash,
  blockNumber,
  timestamp,
  sender,
  event,
}: XcmContext): GenericXcmSentWithContext {
  const messageId = getMessageId(program)

  return new GenericXcmSentWithContext({
    blockHash: blockHash as HexString,
    blockNumber: blockNumber,
    timestamp: timestamp,
    event,
    recipient,
    instructions: {
      bytes: program.data,
      json: program.instructions,
    },
    messageData: data,
    messageHash: program.hash,
    messageId,
    sender,
  })
}

function findDmpMessagesFromEvent(origin: NetworkURN, getDmp: GetDownwardMessageQueues, context: ApiContext) {
  return (source: Observable<BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      map((event) => {
        if (matchEvent(event, 'XcmPallet', 'Sent')) {
          const { destination, message_id } = event.value
          const recipient = networkIdFromMultiLocation(destination, origin)

          if (recipient) {
            return {
              recipient,
              messageId: message_id,
              event,
            }
          }
        }

        return null
      }),
      filterNonNull(),
      mergeMap(({ recipient, messageId, event }) => {
        return getDmp(event.blockHash as HexString, recipient as NetworkURN).pipe(
          map((messages) => {
            const { blockHash, blockNumber, timestamp } = event
            if (messages.length === 1) {
              const data = messages[0].msg.asBytes()
              const program = asVersionedXcm(data, context)
              return createXcmMessageSent({
                blockHash,
                blockNumber,
                timestamp,
                recipient,
                event,
                data,
                program,
                sender: getSendersFromEvent(event),
              })
            } else {
              // Since we are matching by topic and it is assumed that the TopicId is unique
              // we can break out of the loop on first matching message found.
              for (const message of messages) {
                const data = message.msg.asBytes()
                const program = asVersionedXcm(data, context)
                if (matchProgramByTopic(program, messageId)) {
                  return createXcmMessageSent({
                    blockHash,
                    blockNumber,
                    timestamp,
                    recipient,
                    event,
                    data,
                    program,
                    sender: getSendersFromEvent(event),
                  })
                }
              }

              return null
            }
          }),
          filterNonNull(),
        )
      }),
    )
  }
}

export function extractDmpSendByEvent(
  origin: NetworkURN,
  getDmp: GetDownwardMessageQueues,
  context: ApiContext,
) {
  return (source: Observable<BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(findDmpMessagesFromEvent(origin, getDmp, context))
  }
}

function createDmpReceivedWithContext(event: BlockEvent, assetsTrappedEvent?: BlockEvent) {
  const xcmMessage = event.value
  let outcome: 'Success' | 'Fail' = 'Fail'
  outcome = xcmMessage.success ? 'Success' : 'Fail'

  const messageId = xcmMessage.message_id ? xcmMessage.message_id : xcmMessage.id
  const messageHash = xcmMessage.message_hash ?? messageId
  const assetsTrapped = mapAssetsTrapped(assetsTrappedEvent)

  return new GenericXcmInboundWithContext({
    event,
    blockHash: event.blockHash as HexString,
    blockNumber: event.blockNumber,
    timestamp: event.timestamp,
    extrinsicPosition: event.extrinsicPosition,
    messageHash,
    messageId,
    outcome,
    assetsTrapped,
  })
}

export function extractDmpReceive() {
  return (source: Observable<BlockEvent>): Observable<XcmInboundWithContext> => {
    return source.pipe(
      bufferCount(2, 1),
      map(([maybeAssetTrapEvent, maybeDmpEvent]) => {
        // in reality we expect a continuous stream of events but
        // in tests, maybeDmpEvent could be undefined if there are odd number of events
        if (maybeDmpEvent && matchEvent(maybeDmpEvent, 'MessageQueue', 'Processed')) {
          const assetTrapEvent = matchEvent(maybeAssetTrapEvent, 'PolkadotXcm', 'AssetsTrapped')
            ? maybeAssetTrapEvent
            : undefined
          return createDmpReceivedWithContext(maybeDmpEvent, assetTrapEvent)
        }
        return null
      }),
      filterNonNull(),
    )
  }
}
