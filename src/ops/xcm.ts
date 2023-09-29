import type { } from '@polkadot/api-augment';

import { map, tap, from, switchMap, Observable, mergeMap } from 'rxjs';

import type { Vec } from '@polkadot/types';
import type { PolkadotCorePrimitivesOutboundHrmpMessage } from '@polkadot/types/lookup';
import { ApiRx, ApiPromise } from '@polkadot/api';

import {
  Criteria, blocks, extractEventsWithTx, extractTxWithEvents, filterNonNull,
  flattenBatch, mongoFilter, retryWithTruncatedExpBackoff, types
} from '@sodazone/ocelloids';

import { GenericXcmMessageWithContext, XcmCriteria, XcmMessageSentWithContext, XcmMessageWithContext } from '../types.js';

function findOutboundHrmpMessage(
  api: ApiPromise,
  messageCriteria: Criteria
) {
  return (source: Observable<XcmMessageSentWithContext>)
  : Observable<XcmMessageWithContext> => {
    return source.pipe(
      mergeMap(sentMsg => {
        const { event: {blockHash}, messageHash } = sentMsg;
        return from(api.at(blockHash)).pipe(
          retryWithTruncatedExpBackoff(),
          switchMap(at =>
           from(
             at.query.parachainSystem.hrmpOutboundMessages()
           ) as Observable<Vec<PolkadotCorePrimitivesOutboundHrmpMessage>>
          ),
          retryWithTruncatedExpBackoff(),
          map(messages =>  {
            return messages
              .map(msg => {
                const {data, recipient} = msg;
                const xcmProgram = api.registry.createType(
                  'XcmVersionedXcm', data.slice(1)
                );
                return new GenericXcmMessageWithContext({
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
          mongoFilter(messageCriteria)
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

export function extractXcmTransfers(
  api: ApiPromise,
  {
    sendersControl,
    messageCriteria
  }: XcmCriteria
) {
  return (source: Observable<ApiRx>)
  : Observable<XcmMessageWithContext> => {
    return source.pipe(
      blocks(),
      retryWithTruncatedExpBackoff(),
      tap(({block}) => console.log(block.header.number.toNumber())),
      mongoFilter(sendersControl),
      extractTxWithEvents(),
      flattenBatch(),
      extractEventsWithTx(),
      xcmMessagesSent(api),
      findOutboundHrmpMessage(api, messageCriteria),
    );
  };
}