import type { } from '@polkadot/api-augment';

import { map, Observable, mergeMap, tap } from 'rxjs';

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
} from '../../types.js';
import { GetOutboundHrmpMessages } from '../head-catcher.js';

function findOutboundHrmpMessage(
  api: ApiPromise,
  messageControl: ControlQuery,
  getOutboundHrmpMessages: GetOutboundHrmpMessages
) {
  return (source: Observable<XcmMessageSentWithContext>)
  : Observable<GenericXcmMessageSentWithContext> => {
    return source.pipe(
      mergeMap(sentMsg => {
        const { event: {blockHash}, messageHash } = sentMsg;
        return getOutboundHrmpMessages(blockHash.toHex()).pipe(
          tap(_ => console.log('FOUND HRMP INSTRUCTIONS')),
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
          tap(msg => console.log('FOUND MESSAGE', msg.toHuman())),
          mongoFilter(messageControl),
          tap(m => console.log('FILTERED BY MSG CONTROL', m.toHuman()))
        );
      }));
  };
}

function xcmMessagesSent(api: ApiPromise) {
  return (source: Observable<types.EventWithIdAndTx>)
    : Observable<XcmMessageSentWithContext> => {
    return (source.pipe(
      map(event => {
        if (api.events.xcmpQueue.XcmpMessageSent.is(event)) {
          const xcmMessage = event.data as any;
          return {
            event,
            messageHash: xcmMessage.messageHash.toHex() as string
          } as XcmMessageSentWithContext;
        } else {
          return null;
        }
      }),
      filterNonNull()
    ));
  };
}

export function extractXcmSend(
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
      mongoFilter(sendersControl),
      extractTxWithEvents(),
      flattenBatch(),
      extractEventsWithTx(),
      xcmMessagesSent(api),
      tap(msg => console.log('SEND XCM MESSAGE', msg.messageHash)),
      findOutboundHrmpMessage(api, messageControl, getOutboundHrmpMessages),
      tap(msg => console.log('SEND XCM MESSAGE WITH INSTRUCTIONS', msg.toHuman())),
    );
  };
}

function mapXcmpQueueMessage() {
  return (source: Observable<types.EventWithIdAndTx>):
  Observable<XcmMessageReceivedWithContext>  => {
    return (source.pipe(
      mongoFilter({
        'section': 'xcmpQueue',
        'method': { $in: ['Success', 'Fail']}
      }),
      map(event => {
        if (event.method === 'Success') {
          const xcmMessage = event.data as any;
          return new GenericXcmMessageReceivedWithContext({
            event,
            messageHash: xcmMessage.messageHash.toHex() as string,
            outcome: event.method,
            error: null
          });
        } else if (event.method === 'Fail') {
          const xcmMessage = event.data as any;
          const error = xcmMessage.error;
          console.log('XCM receive fail', error.toHuman());
          return new GenericXcmMessageReceivedWithContext({
            event,
            messageHash: xcmMessage.messageHash.toHex() as string,
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

export function extractXcmReceive() {
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