import { Observable, filter, map, mergeMap } from 'rxjs'

import { filterNonNull } from '@/common/index.js'
import { createNetworkId } from '@/services/config.js'
import { BlockEvent, SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { NetworkURN } from '@/services/types.js'

import { GenericXcmSentWithContext, GetOutboundHrmpMessages, XcmSentWithContext } from '../types/index.js'
import { xcmMessagesSent } from './common.js'
import { getMessageId, matchEvent } from './util.js'
import { fromXcmpFormat } from './xcm-format.js'

export const METHODS_XCMP_QUEUE = ['Success', 'Fail']

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
