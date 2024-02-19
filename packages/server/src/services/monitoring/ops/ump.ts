import { mergeMap, map, Observable, filter } from 'rxjs';

// NOTE: we use Polkadot augmented types
import '@polkadot/api-augment/polkadot';
import type {
  PolkadotRuntimeParachainsInclusionAggregateMessageOrigin,
  FrameSupportMessagesProcessMessageError
} from '@polkadot/types/lookup';

import type { U8aFixed, bool } from '@polkadot/types-codec';

import {
  ControlQuery,
  filterNonNull,
  types
} from '@sodazone/ocelloids';

import {
  GenericXcmInboundWithContext,
  GenericXcmSentWithContext,
  GetOutboundUmpMessages,
  XcmCriteria, XcmInboundWithContext,
  XcmSentWithContext
} from '../types.js';
import { getMessageId, getParaIdFromOrigin, matchEvent } from './util.js';
import { asVersionedXcm } from './xcm-format.js';
import { matchMessage, matchSenders } from './criteria.js';

const METHODS_MQ_PROCESSED = ['Processed','ProcessingFailed'];

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
): XcmInboundWithContext | null {
  // Received event only emits field `message_id`,
  // which is actually the message hash in the current runtime.
  const messageId = id.toHex();
  const messageHash = messageId;
  const messageOrigin = getParaIdFromOrigin(origin);
  // If we can get message origin, only return message if origin matches with subscription origin
  // If no origin, we will return the message without matching with subscription origin
  if (messageOrigin === undefined || messageOrigin === subOrigin) {
    return new GenericXcmInboundWithContext({
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
                  instructions: xcmProgram
                });
              }).find(msg => {
                return messageId ? msg.messageId === messageId : msg.messageHash === messageHash;
              });
          }),
          filterNonNull(),
          filter(xcm => matchMessage(messageControl, xcm))
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
  return (source: Observable<types.BlockEvent>)
      : Observable<XcmSentWithContext> => {
    return source.pipe(
      filter(event => ((
        matchEvent(event, 'parachainSystem', 'UpwardMessageSent')
        || matchEvent(event, 'polkadotXcm', 'Sent')
      ) && matchSenders(sendersControl, event.extrinsic)
      )),
      umpMessagesSent(),
      findOutboundUmpMessage(
        messageControl,
        getOutboundUmpMessages
      )
    );
  };
}

export function extractUmpReceive(originId: string) {
  return (source: Observable<types.BlockEvent>)
    : Observable<XcmInboundWithContext>  => {
    return (source.pipe(
      map(event => {
        if (matchEvent(event, 'messageQueue', METHODS_MQ_PROCESSED))
        {
          return createUmpReceivedWithContext(
            event,
            originId,
            event.data as unknown as UmpReceivedContext
          );
        }
        return null;
      }),
      filterNonNull()
    ));
  };
}

