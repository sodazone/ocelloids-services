import { mergeMap, map, Observable } from 'rxjs';

import type { SignedBlockExtended } from '@polkadot/api-derive/types';
import type { U8aFixed, bool } from '@polkadot/types-codec';
import type {
  PolkadotRuntimeParachainsInclusionAggregateMessageOrigin,
  FrameSupportMessagesProcessMessageError
} from '@polkadot/types/lookup';
import type { ApiPromise } from '@polkadot/api';

import {
  ControlQuery,
  extractEvents,
  filterEvents, filterNonNull,
  mongoFilter, types
} from '@sodazone/ocelloids';

import {
  GenericXcmReceivedWithContext,
  GenericXcmSentWithContext,
  GetOutboundUmpMessages,
  XcmCriteria, XcmReceivedWithContext,
  XcmSentWithContext
} from '../types.js';
import { getMessageId, getParaIdFromOrigin } from './util.js';
import { asVersionedXcm } from './xcm-format.js';

type UmpReceivedContext = {
  id: U8aFixed,
  origin: PolkadotRuntimeParachainsInclusionAggregateMessageOrigin,
  success?: bool,
  error?: FrameSupportMessagesProcessMessageError
};

function createUmpReceivedWithContext(
  event: types.BlockEvent,
  subOrigin: string,
  {
    id,
    origin,
    success,
    error
  }: UmpReceivedContext
): XcmReceivedWithContext | null {
  // Received event only emits field `message_id`,
  // which is actually the message hash in the current runtime.
  const messageId = id.toHex();
  const messageHash = messageId;
  const messageOrigin = getParaIdFromOrigin(origin);
  // If we can get message origin, only return message if origin matches with subscription origin
  // If no origin, we will return the message without matching with subscription origin
  if (messageOrigin === undefined || messageOrigin === subOrigin) {
    return new GenericXcmReceivedWithContext({
      event: event.toHuman(),
      blockHash: event.blockHash.toHex(),
      blockNumber: event.blockNumber.toPrimitive(),
      messageHash,
      messageId,
      outcome: success?.isTrue ? 'Success' : 'Fail',
      error: error ? error.toHuman() : null
    });
  }
  return null;
}

function umpMessagesSent() {
  return (source: Observable<types.BlockEvent>)
        : Observable<XcmSentWithContext> => {
    return (source.pipe(
      map(event => {
        const xcmMessage = event.data as any;
        return {
          event: event.toHuman(),
          blockHash: event.blockHash.toHex(),
          blockNumber: event.blockNumber.toPrimitive(),
          extrinsicId: event.extrinsicId,
          messageHash: xcmMessage.messageHash?.toHex(),
          messageId: xcmMessage.messageId?.toHex(),
          sender: event.extrinsic?.signer.toHuman()
        } as XcmSentWithContext;
      })
    ));
  };
}

function findOutboundUmpMessage(
  messageControl: ControlQuery,
  getOutboundUmpMessages: GetOutboundUmpMessages
) {
  return (source: Observable<XcmSentWithContext>)
  : Observable<XcmSentWithContext> => {
    return source.pipe(
      mergeMap(sentMsg => {
        const { blockHash, messageHash, messageId } = sentMsg;
        return getOutboundUmpMessages(blockHash).pipe(
          map(messages =>  {
            return messages
              .map(data => {
                const xcmProgram = asVersionedXcm(data);
                return new GenericXcmSentWithContext({
                  ...sentMsg,
                  messageData: data.toU8a(),
                  recipient: '0', // always relay
                  messageHash: xcmProgram.hash.toHex(),
                  messageId: getMessageId(xcmProgram),
                  instructions: xcmProgram.toHuman()
                });
              }).find(msg => {
                return messageId ? msg.messageId === messageId : msg.messageHash === messageHash;
              });
          }),
          filterNonNull(),
          mongoFilter(messageControl)
        );
      }));
  };
}

export function extractUmpSend(
  {
    sendersControl,
    messageControl
  }: XcmCriteria,
  getOutboundUmpMessages: GetOutboundUmpMessages
) {
  return (source: Observable<SignedBlockExtended>)
      : Observable<XcmSentWithContext> => {
    return source.pipe(
      filterEvents({
        $or: [
          {
            'section': 'parachainSystem',
            'method': 'UpwardMessageSent'
          },
          {
            'section': 'polkadotXcm',
            'method': 'Sent'
          }
        ]
      }),
      mongoFilter(sendersControl),
      umpMessagesSent(),
      findOutboundUmpMessage(
        messageControl,
        getOutboundUmpMessages
      )
    );
  };
}

export function extractUmpReceive(api: ApiPromise, originId: string) {
  return (source: Observable<SignedBlockExtended>)
    : Observable<XcmReceivedWithContext>  => {
    return (source.pipe(
      extractEvents(),
      map(event => {
        if (
          api.events.messageQueue.Processed.is(event) ||
          api.events.messageQueue.ProcessingFailed.is(event)
        ) {
          return createUmpReceivedWithContext(event, originId, event.data)
        }
        return null;
      }),
      filterNonNull()
    ));
  };
}

