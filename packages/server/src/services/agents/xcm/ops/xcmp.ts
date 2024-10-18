import { Observable, bufferCount, filter, map, mergeMap } from 'rxjs'

import { filterNonNull } from '@sodazone/ocelloids-sdk'

import { HexString } from '@/lib.js'
import { createNetworkId } from '@/services/config.js'
import { ApiContext, BlockEvent } from '@/services/networking/index.js'
import { NetworkURN } from '@/services/types.js'
import { asSerializable } from '../../base/util.js'
import { GetOutboundHrmpMessages } from '../types-augmented.js'
import {
  GenericXcmInboundWithContext,
  GenericXcmSentWithContext,
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
  context: ApiContext,
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
                      messageData: xcmProgram.data,
                      recipient: createNetworkId(origin, recipient.toString()),
                      messageHash: xcmProgram.hash,
                      instructions: {
                        bytes: xcmProgram.data,
                        json: asSerializable(xcmProgram.instructions),
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
  context: ApiContext,
) {
  return (source: Observable<BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      filter(
        (event) =>
          matchEvent(event, 'XcmpQueue', 'XcmpMessageSent') || matchEvent(event, 'PolkadotXcm', 'Sent'),
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
            event: asSerializable(maybeXcmpEvent),
            blockHash: maybeXcmpEvent.blockHash as HexString,
            blockNumber: maybeXcmpEvent.blockNumber,
            timestamp: maybeXcmpEvent.timestamp,
            extrinsicPosition: maybeXcmpEvent.extrinsicPosition,
            messageHash: xcmpQueueData.messageHash,
            messageId: xcmpQueueData.messageId,
            outcome: maybeXcmpEvent.name === 'Success' ? 'Success' : 'Fail',
            error: xcmpQueueData.error,
            assetsTrapped,
          })
        } else if (matchEvent(maybeXcmpEvent, 'MessageQueue', 'Processed')) {
          const { id, success, error } = maybeXcmpEvent.value as unknown as any // MessageQueueEventContext
          // Received event only emits field `message_id`,
          // which is actually the message hash in chains that do not yet support Topic ID.
          const messageId = id
          const messageHash = messageId

          return new GenericXcmInboundWithContext({
            event: asSerializable(maybeXcmpEvent),
            blockHash: maybeXcmpEvent.blockHash as HexString,
            blockNumber: maybeXcmpEvent.blockNumber,
            timestamp: maybeXcmpEvent.timestamp,
            messageHash,
            messageId,
            outcome: success?.isTrue ? 'Success' : 'Fail',
            error: error ? asSerializable(error) : null,
            assetsTrapped,
          })
        }

        return null
      }),
      filterNonNull(),
    )
  }
}
