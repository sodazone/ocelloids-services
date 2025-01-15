import { Observable, bufferCount, filter, map, mergeMap } from 'rxjs'

import { filterNonNull } from '@/common/index.js'
import { HexString } from '@/lib.js'
import { createNetworkId } from '@/services/config.js'
import { BlockEvent, SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { NetworkURN } from '@/services/types.js'

import {
  GenericXcmInboundWithContext,
  GenericXcmSentWithContext,
  GetOutboundHrmpMessages,
  XcmInboundWithContext,
  XcmSentWithContext,
} from '../types.js'
import { xcmMessagesSent } from './common.js'
import { getMessageId, mapAssetsTrapped, matchEvent } from './util.js'
import { fromXcmpFormat } from './xcm-format.js'

const METHODS_XCMP_QUEUE = ['Success', 'Fail']

function findOutboundHrmpMessage(
  origin: NetworkURN,
  getOutboundHrmpMessages: GetOutboundHrmpMessages,
  context: SubstrateApiContext,
) {
  return (source: Observable<XcmSentWithContext>): Observable<GenericXcmSentWithContext> => {
    return source.pipe(
      mergeMap((sentMsg): Observable<GenericXcmSentWithContext> => {
        const { blockHash, messageHash, messageId } = sentMsg
        return getOutboundHrmpMessages(blockHash).pipe(
          map((messages) => {
            return messages
              .flatMap((msg) => {
                const { data, recipient } = msg
                // TODO: caching strategy
                const xcms = fromXcmpFormat(data.asBytes(), context)
                return xcms.map(
                  (xcmProgram) =>
                    new GenericXcmSentWithContext({
                      ...sentMsg,
                      messageDataBuffer: xcmProgram.data,
                      recipient: createNetworkId(origin, recipient.toString()),
                      messageHash: xcmProgram.hash,
                      instructions: {
                        bytes: xcmProgram.data,
                        json: xcmProgram.instructions,
                      },
                      messageId: getMessageId(xcmProgram),
                    }),
                )
              })
              .find((msg) => {
                return messageId ? msg.messageId === messageId : msg.messageHash === messageHash
              })
          }),
          filterNonNull(),
        )
      }),
    )
  }
}

export function extractXcmpSend(
  origin: NetworkURN,
  getOutboundHrmpMessages: GetOutboundHrmpMessages,
  context: SubstrateApiContext,
) {
  return (source: Observable<BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      filter((event) =>
        // note that we extract the message id from
        // setTopic instruction, if any
        matchEvent(event, 'XcmpQueue', 'XcmpMessageSent'),
      ),
      xcmMessagesSent(),
      findOutboundHrmpMessage(origin, getOutboundHrmpMessages, context),
    )
  }
}

export function extractXcmpReceive() {
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
        }

        return null
      }),
      filterNonNull(),
    )
  }
}
