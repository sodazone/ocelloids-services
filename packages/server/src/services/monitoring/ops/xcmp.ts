import type { Registry } from '@polkadot/types/types'
import { Observable, bufferCount, filter, map, mergeMap } from 'rxjs'

import { filterNonNull, types } from '@sodazone/ocelloids-sdk'

import { createNetworkId } from '../../config.js'
import { NetworkURN } from '../../types.js'
import { GetOutboundHrmpMessages } from '../types-augmented.js'
import {
  GenericXcmInboundWithContext,
  GenericXcmSentWithContext,
  MessageQueueEventContext,
  XcmInboundWithContext,
  XcmSentWithContext,
} from '../types.js'
import { blockEventToHuman, xcmMessagesSent } from './common.js'
import { getMessageId, mapAssetsTrapped, matchEvent } from './util.js'
import { fromXcmpFormat } from './xcm-format.js'

const METHODS_XCMP_QUEUE = ['Success', 'Fail']

function findOutboundHrmpMessage(
  origin: NetworkURN,
  getOutboundHrmpMessages: GetOutboundHrmpMessages,
  registry: Registry
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
                const xcms = fromXcmpFormat(data, registry)
                return xcms.map(
                  (xcmProgram) =>
                    new GenericXcmSentWithContext({
                      ...sentMsg,
                      messageData: xcmProgram.toU8a(),
                      recipient: createNetworkId(origin, recipient.toNumber().toString()),
                      messageHash: xcmProgram.hash.toHex(),
                      instructions: {
                        bytes: xcmProgram.toU8a(),
                        json: xcmProgram.toHuman(),
                      },
                      messageId: getMessageId(xcmProgram),
                    })
                )
              })
              .find((msg) => {
                return messageId ? msg.messageId === messageId : msg.messageHash === messageHash
              })
          }),
          filterNonNull()
        )
      })
    )
  }
}

export function extractXcmpSend(
  origin: NetworkURN,
  getOutboundHrmpMessages: GetOutboundHrmpMessages,
  registry: Registry
) {
  return (source: Observable<types.BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      filter((event) => matchEvent(event, 'xcmpQueue', 'XcmpMessageSent') || matchEvent(event, 'polkadotXcm', 'Sent')),
      xcmMessagesSent(),
      findOutboundHrmpMessage(origin, getOutboundHrmpMessages, registry)
    )
  }
}

export function extractXcmpReceive() {
  return (source: Observable<types.BlockEvent>): Observable<XcmInboundWithContext> => {
    return source.pipe(
      bufferCount(2, 1),
      // eslint-disable-next-line complexity
      map(([maybeAssetTrapEvent, maybeXcmpEvent]) => {
        if (maybeXcmpEvent === undefined) {
          return null
        }

        const assetTrapEvent = matchEvent(maybeAssetTrapEvent, ['xcmPallet', 'polkadotXcm'], 'AssetsTrapped')
          ? maybeAssetTrapEvent
          : undefined
        const assetsTrapped = mapAssetsTrapped(assetTrapEvent)

        if (matchEvent(maybeXcmpEvent, 'xcmpQueue', METHODS_XCMP_QUEUE)) {
          const xcmpQueueData = maybeXcmpEvent.data as any

          return new GenericXcmInboundWithContext({
            event: blockEventToHuman(maybeXcmpEvent),
            blockHash: maybeXcmpEvent.blockHash.toHex(),
            blockNumber: maybeXcmpEvent.blockNumber.toPrimitive(),
            extrinsicId: maybeXcmpEvent.extrinsicId,
            messageHash: xcmpQueueData.messageHash.toHex(),
            messageId: xcmpQueueData.messageId?.toHex(),
            outcome: maybeXcmpEvent.method === 'Success' ? 'Success' : 'Fail',
            error: xcmpQueueData.error,
            assetsTrapped,
          })
        } else if (matchEvent(maybeXcmpEvent, 'messageQueue', 'Processed')) {
          const { id, success, error } = maybeXcmpEvent.data as unknown as MessageQueueEventContext
          // Received event only emits field `message_id`,
          // which is actually the message hash in chains that do not yet support Topic ID.
          const messageId = id.toHex()
          const messageHash = messageId

          return new GenericXcmInboundWithContext({
            event: blockEventToHuman(maybeXcmpEvent),
            blockHash: maybeXcmpEvent.blockHash.toHex(),
            blockNumber: maybeXcmpEvent.blockNumber.toPrimitive(),
            messageHash,
            messageId,
            outcome: success?.isTrue ? 'Success' : 'Fail',
            error: error ? error.toHuman() : null,
            assetsTrapped,
          })
        }

        return null
      }),
      filterNonNull()
    )
  }
}
