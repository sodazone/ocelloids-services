import { Observable, bufferCount, filter, map, mergeMap } from 'rxjs'

import { filterNonNull } from '@/common/index.js'
import { HexString } from '@/lib.js'
import { getRelayId } from '@/services/config.js'
import { BlockEvent, SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { NetworkURN } from '@/services/types.js'

import {
  GenericXcmInboundWithContext,
  GenericXcmSentWithContext,
  GetOutboundUmpMessages,
  XcmInboundWithContext,
  XcmSentWithContext,
} from '../types.js'
import { xcmMessagesSent } from './common.js'
import { getMessageId, mapAssetsTrapped, matchEvent } from './util.js'
import { asVersionedXcm } from './xcm-format.js'

const METHODS_MQ_PROCESSED = ['Processed', 'ProcessingFailed']

function createUmpReceivedWithContext(
  event: BlockEvent,
  assetsTrappedEvent?: BlockEvent,
): XcmInboundWithContext | null {
  const { id, success, error } = event.value as {
    id: HexString
    error?: any
    origin: { type: string; value: { type: string; value: number } }
    success: boolean
  }
  // Received event only emits field `message_id`,
  // which is actually the message hash in the current runtime.
  const messageId = id
  const messageHash = messageId
  const assetsTrapped = mapAssetsTrapped(assetsTrappedEvent)

  return new GenericXcmInboundWithContext({
    event,
    extrinsicHash: event.extrinsic?.hash as HexString,
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
                  messageDataBuffer: xcmProgram.data,
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

export function extractUmpReceive() {
  return (source: Observable<BlockEvent>): Observable<XcmInboundWithContext> => {
    return source.pipe(
      bufferCount(2, 1),
      map(([maybeAssetTrapEvent, maybeUmpEvent]) => {
        if (maybeUmpEvent && matchEvent(maybeUmpEvent, 'MessageQueue', METHODS_MQ_PROCESSED)) {
          const assetTrapEvent = matchEvent(maybeAssetTrapEvent, 'XcmPallet', 'AssetsTrapped')
            ? maybeAssetTrapEvent
            : undefined
          return createUmpReceivedWithContext(maybeUmpEvent, assetTrapEvent)
        }
        return null
      }),
      filterNonNull(),
    )
  }
}
