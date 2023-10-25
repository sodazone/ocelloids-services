import type { } from '@polkadot/api-augment';

import { map, Observable, mergeMap } from 'rxjs';

import type { SignedBlockExtended } from '@polkadot/api-derive/types';
import { ApiPromise } from '@polkadot/api';

import {
  ControlQuery,
  extractEventsWithTx, extractTxWithEvents, filterNonNull,
  flattenBatch, mongoFilter, types
} from '@sodazone/ocelloids';

import {
  GenericXcmMessageReceivedWithContext,
  GenericXcmMessageSentWithContext, XcmCriteria, XcmMessageReceivedWithContext,
  XcmMessageSentWithContext
} from '../types.js';
import { GetOutboundHrmpMessages } from '../types.js';

function findOutboundHrmpMessage(
  api: ApiPromise,
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
                const xcmProgram = api.registry.createType(
                  'XcmVersionedXcm', data.slice(1)
                );
                return new GenericXcmMessageSentWithContext({
                  ...sentMsg,
                  messageData: data,
                  recipient: recipient.toNumber(),
                  messageHash: xcmProgram.hash.toHex(),
                  instructions: xcmProgram.toHuman()
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
  api: ApiPromise,
  {
    sendersControl,
    messageControl
  }: XcmCriteria,
  getOutboundHrmpMessages: GetOutboundHrmpMessages
) {
  return (source: Observable<SignedBlockExtended>)
  : Observable<XcmMessageSentWithContext> => {
    return source.pipe(
      extractTxWithEvents(),
      flattenBatch(),
      mongoFilter(sendersControl),
      extractEventsWithTx(),
      mongoFilter({
        'section': 'xcmpQueue',
        'method': 'XcmpMessageSent'
      }),
      xcmpMessagesSent(),
      findOutboundHrmpMessage(api, messageControl, getOutboundHrmpMessages),
    );
  };
}

function mapXcmpQueueMessage() {
  return (source: Observable<types.EventWithIdAndTx>):
  Observable<XcmMessageReceivedWithContext>  => {
    return (source.pipe(
      mongoFilter({
        'section': 'xcmpQueue',
        'method': { $in: ['Success', 'Fail'] }
      }),
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
      extractTxWithEvents(),
      flattenBatch(),
      extractEventsWithTx(),
      mapXcmpQueueMessage()
    ));
  };
}