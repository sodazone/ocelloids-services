import type { } from '@polkadot/api-augment';

import { map, Observable, mergeMap } from 'rxjs';

import type { SignedBlockExtended } from '@polkadot/api-derive/types';

import {
  ControlQuery,
  filterEvents, filterNonNull,
  mongoFilter, types
} from '@sodazone/ocelloids';

import {
  GenericXcmMessageReceivedWithContext,
  GenericXcmMessageSentWithContext, XcmCriteria, XcmMessageReceivedWithContext,
  XcmMessageSentWithContext
} from '../types.js';
import { GetOutboundHrmpMessages } from '../types.js';
import { asVersionedXcm, getMessageId } from './util.js';

function findOutboundHrmpMessage(
  messageControl: ControlQuery,
  getOutboundHrmpMessages: GetOutboundHrmpMessages
) {
  return (source: Observable<XcmMessageSentWithContext>)
  : Observable<GenericXcmMessageSentWithContext> => {
    return source.pipe(
      mergeMap(sentMsg => {
        const { blockHash, messageHash } = sentMsg;
        return getOutboundHrmpMessages(blockHash).pipe(
          map(messages =>  {
            return messages
              .map(msg => {
                const {data, recipient} = msg;
                const xcmProgram = asVersionedXcm(data);
                return new GenericXcmMessageSentWithContext({
                  ...sentMsg,
                  messageData: data,
                  recipient: recipient.toNumber(),
                  messageHash: xcmProgram.hash.toHex(),
                  instructions: xcmProgram.toHuman(),
                  messageId: getMessageId(xcmProgram)
                });
              }).find(msg => {
                return msg.messageHash === messageHash;
              });
          }),
          filterNonNull(),
          mongoFilter(messageControl)
        );
      }));
  };
}

function xcmpMessagesSent() {
  return (source: Observable<types.EventWithIdAndTx>)
    : Observable<XcmMessageSentWithContext> => {
    return (source.pipe(
      map(event => {
        const xcmMessage = event.data as any;
        return {
          event: event.toHuman(),
          sender: event.extrinsic.signer.toHuman(),
          blockHash: event.blockHash.toHex(),
          blockNumber: event.blockNumber.toString(),
          extrinsicId: event.extrinsicId,
          messageHash: xcmMessage.messageHash.toHex()
        } as XcmMessageSentWithContext;
      })
    ));
  };
}

export function extractXcmpSend(
  {
    sendersControl,
    messageControl
  }: XcmCriteria,
  getOutboundHrmpMessages: GetOutboundHrmpMessages
) {
  return (source: Observable<SignedBlockExtended>)
  : Observable<XcmMessageSentWithContext> => {
    return source.pipe(
      filterEvents(
        // events filter criteria
        {
          'section': 'xcmpQueue',
          'method': 'XcmpMessageSent'
        },
        // extrinsics filter criteria
        // NOTE: we are not flattening extrinsics here
        // since we are filtering by events
        {
          'dispatchError': { $eq: undefined }
        }
      ),
      mongoFilter(sendersControl),
      xcmpMessagesSent(),
      findOutboundHrmpMessage(messageControl, getOutboundHrmpMessages),
    );
  };
}

function mapXcmpQueueMessage() {
  return (source: Observable<types.EventWithIdAndTx>):
  Observable<XcmMessageReceivedWithContext>  => {
    return (source.pipe(
      map(event => {
        if (event.method === 'Success') {
          const xcmMessage = event.data as any;
          return new GenericXcmMessageReceivedWithContext({
            event: event.toHuman(),
            blockHash: event.blockHash.toHex(),
            blockNumber: event.blockNumber.toString(),
            extrinsicId: event.extrinsicId,
            messageHash: xcmMessage.messageHash.toHex(),
            outcome: event.method,
            error: null
          });
        } else if (event.method === 'Fail') {
          const xcmMessage = event.data as any;
          const error = xcmMessage.error;
          return new GenericXcmMessageReceivedWithContext({
            event: event.toHuman(),
            blockHash: event.blockHash.toHex(),
            blockNumber: event.blockNumber.toString(),
            extrinsicId: event.extrinsicId,
            messageHash: xcmMessage.messageHash.toHex(),
            outcome: event.method,
            error: error
          });
        } else {
          return null;
        }
      }),
      filterNonNull()
    )
    );
  };
}

export function extractXcmpReceive() {
  return (source: Observable<SignedBlockExtended>)
  : Observable<XcmMessageReceivedWithContext>  => {
    return (source.pipe(
      filterEvents(
        // event filter criteria
        {
          'section': 'xcmpQueue',
          'method': { $in: ['Success', 'Fail'] }
        }
      ),
      mapXcmpQueueMessage()
    ));
  };
}