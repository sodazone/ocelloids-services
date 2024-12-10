import { Observable, bufferCount, filter, map, mergeMap } from 'rxjs'

import { filterNonNull } from '@/common/index.js'
import { HexString } from '@/lib.js'
import { getChainId, getRelayId } from '@/services/config.js'
import { BlockEvent, SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { NetworkURN } from '@/services/types.js'

import { GetOutboundUmpMessages } from '../types-augmented.js'
import {
  GenericXcmInboundWithContext,
  GenericXcmSentWithContext,
  XcmInboundWithContext,
  XcmSentWithContext,
} from '../types.js'
import { xcmMessagesSent } from './common.js'
import { getMessageId, getParaIdFromOrigin, mapAssetsTrapped, matchEvent } from './util.js'
import { asVersionedXcm } from './xcm-format.js'

const METHODS_MQ_PROCESSED = ['Processed', 'ProcessingFailed']

function createUmpReceivedWithContext(
  subOrigin: NetworkURN,
  event: BlockEvent,
  assetsTrappedEvent?: BlockEvent,
): XcmInboundWithContext | null {
  const { id, origin, success, error } = event.value as {
    id: HexString
    error?: any
    origin: { type: string; value: { type: string; value: number } }
    success: boolean
  }
  // Received event only emits field `message_id`,
  // which is actually the message hash in the current runtime.
  const messageId = id
  const messageHash = messageId
  const messageOrigin = getParaIdFromOrigin(origin)
  const assetsTrapped = mapAssetsTrapped(assetsTrappedEvent)
  // If we can get message origin, only return message if origin matches with subscription origin
  // If no origin, we will return the message without matching with subscription origin
  if (messageOrigin === undefined || messageOrigin === getChainId(subOrigin)) {
    return new GenericXcmInboundWithContext({
      event,
      blockHash: event.blockHash as HexString,
      blockNumber: event.blockNumber,
      timestamp: event.timestamp,
      messageHash,
      messageId,
      outcome: success ? 'Success' : 'Fail',
      error,
      assetsTrapped,
    })
  }
  return null
}

function findOutboundUmpMessage(
  origin: NetworkURN,
  getOutboundUmpMessages: GetOutboundUmpMessages,
  context: SubstrateApiContext,
) {
  return (source: Observable<XcmSentWithContext>): Observable<XcmSentWithContext> => {
    return source.pipe(
      mergeMap((sentMsg) => {
        const { blockHash, messageHash, messageId } = sentMsg
        return getOutboundUmpMessages(blockHash).pipe(
          map((messages) => {
            return messages
              .map((data) => {
                const bytes = data.asBytes()
                const xcmProgram = asVersionedXcm(bytes, context)
                return new GenericXcmSentWithContext({
                  ...sentMsg,
                  messageData: xcmProgram.data,
                  recipient: getRelayId(origin), // always relay
                  messageHash: xcmProgram.hash,
                  messageId: getMessageId(xcmProgram),
                  instructions: {
                    bytes: xcmProgram.data,
                    json: xcmProgram.instructions,
                  },
                })
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

export function extractUmpSend(
  origin: NetworkURN,
  getOutboundUmpMessages: GetOutboundUmpMessages,
  context: SubstrateApiContext,
) {
  return (source: Observable<BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      filter(
        (event) =>
          matchEvent(event, 'ParachainSystem', 'UpwardMessageSent') ||
          matchEvent(event, 'PolkadotXcm', 'Sent'),
      ),
      xcmMessagesSent(),
      findOutboundUmpMessage(origin, getOutboundUmpMessages, context),
    )
  }
}

export function extractUmpReceive(originId: NetworkURN) {
  return (source: Observable<BlockEvent>): Observable<XcmInboundWithContext> => {
    return source.pipe(
      bufferCount(2, 1),
      map(([maybeAssetTrapEvent, maybeUmpEvent]) => {
        if (maybeUmpEvent && matchEvent(maybeUmpEvent, 'MessageQueue', METHODS_MQ_PROCESSED)) {
          const assetTrapEvent = matchEvent(maybeAssetTrapEvent, 'XcmPallet', 'AssetsTrapped')
            ? maybeAssetTrapEvent
            : undefined
          return createUmpReceivedWithContext(originId, maybeUmpEvent, assetTrapEvent)
        }
        return null
      }),
      filterNonNull(),
    )
  }
}
