import { Observable, bufferCount, filter, map, mergeMap } from 'rxjs'

// NOTE: we use Polkadot augmented types
import '@polkadot/api-augment/polkadot'
import type { Registry } from '@polkadot/types/types'

import { filterNonNull, types } from '@sodazone/ocelloids-sdk'

import { getChainId, getRelayId } from '../../../config.js'
import { NetworkURN } from '../../../types.js'
import { GetOutboundUmpMessages } from '../types-augmented.js'
import {
  GenericXcmInboundWithContext,
  GenericXcmSentWithContext,
  XcmInboundWithContext,
  XcmSentWithContext,
} from '../types.js'
import { MessageQueueEventContext } from '../types.js'
import { blockEventToHuman, xcmMessagesSent } from './common.js'
import { getMessageId, getParaIdFromOrigin, mapAssetsTrapped, matchEvent } from './util.js'
import { asVersionedXcm } from './xcm-format.js'

const METHODS_MQ_PROCESSED = ['Processed', 'ProcessingFailed']

function createUmpReceivedWithContext(
  subOrigin: NetworkURN,
  event: types.BlockEvent,
  assetsTrappedEvent?: types.BlockEvent
): XcmInboundWithContext | null {
  const { id, origin, success, error } = event.data as unknown as MessageQueueEventContext
  // Received event only emits field `message_id`,
  // which is actually the message hash in the current runtime.
  const messageId = id.toHex()
  const messageHash = messageId
  const messageOrigin = getParaIdFromOrigin(origin)
  const assetsTrapped = mapAssetsTrapped(assetsTrappedEvent)
  // If we can get message origin, only return message if origin matches with subscription origin
  // If no origin, we will return the message without matching with subscription origin
  if (messageOrigin === undefined || messageOrigin === getChainId(subOrigin)) {
    return new GenericXcmInboundWithContext({
      event: blockEventToHuman(event),
      blockHash: event.blockHash.toHex(),
      blockNumber: event.blockNumber.toPrimitive(),
      messageHash,
      messageId,
      outcome: success?.isTrue ? 'Success' : 'Fail',
      error: error ? error.toHuman() : null,
      assetsTrapped,
    })
  }
  return null
}

function findOutboundUmpMessage(
  origin: NetworkURN,
  getOutboundUmpMessages: GetOutboundUmpMessages,
  registry: Registry
) {
  return (source: Observable<XcmSentWithContext>): Observable<XcmSentWithContext> => {
    return source.pipe(
      mergeMap((sentMsg) => {
        const { blockHash, messageHash, messageId } = sentMsg
        return getOutboundUmpMessages(blockHash).pipe(
          map((messages) => {
            return messages
              .map((data) => {
                const xcmProgram = asVersionedXcm(data, registry)
                return new GenericXcmSentWithContext({
                  ...sentMsg,
                  messageData: data.toU8a(),
                  recipient: getRelayId(origin), // always relay
                  messageHash: xcmProgram.hash.toHex(),
                  messageId: getMessageId(xcmProgram),
                  instructions: {
                    bytes: xcmProgram.toU8a(),
                    json: xcmProgram.toHuman(),
                  },
                })
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

export function extractUmpSend(origin: NetworkURN, getOutboundUmpMessages: GetOutboundUmpMessages, registry: Registry) {
  return (source: Observable<types.BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      filter(
        (event) => matchEvent(event, 'parachainSystem', 'UpwardMessageSent') || matchEvent(event, 'polkadotXcm', 'Sent')
      ),
      xcmMessagesSent(),
      findOutboundUmpMessage(origin, getOutboundUmpMessages, registry)
    )
  }
}

export function extractUmpReceive(originId: NetworkURN) {
  return (source: Observable<types.BlockEvent>): Observable<XcmInboundWithContext> => {
    return source.pipe(
      bufferCount(2, 1),
      map(([maybeAssetTrapEvent, maybeUmpEvent]) => {
        if (maybeUmpEvent && matchEvent(maybeUmpEvent, 'messageQueue', METHODS_MQ_PROCESSED)) {
          const assetTrapEvent = matchEvent(maybeAssetTrapEvent, 'xcmPallet', 'AssetsTrapped')
            ? maybeAssetTrapEvent
            : undefined
          return createUmpReceivedWithContext(originId, maybeUmpEvent, assetTrapEvent)
        }
        return null
      }),
      filterNonNull()
    )
  }
}
