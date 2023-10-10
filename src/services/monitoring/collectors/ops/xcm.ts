import type { } from '@polkadot/api-augment';

import { map, from, switchMap, Observable, mergeMap } from 'rxjs';

import type { Vec } from '@polkadot/types';
import type { SignedBlockExtended } from '@polkadot/api-derive/types';
import type { PolkadotCorePrimitivesOutboundHrmpMessage } from '@polkadot/types/lookup';
import { ApiPromise } from '@polkadot/api';

import {
  ControlQuery,
  extractEventsWithTx, extractTxWithEvents, filterNonNull,
  flattenBatch, mongoFilter, retryWithTruncatedExpBackoff, types
} from '@sodazone/ocelloids';

import {
  GenericXcmMessageWithContext, XcmCriteria, XcmMessageEvent,
  XcmMessageSentWithContext, XcmMessageWithContext
} from '../../types.js';

function findOutboundHrmpMessage(
  api: ApiPromise,
  messageControl: ControlQuery
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
          mongoFilter(messageControl)
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
  }: XcmCriteria
) {
  return (source: Observable<SignedBlockExtended>)
  : Observable<XcmMessageWithContext> => {
    return source.pipe(
      mongoFilter(sendersControl),
      extractTxWithEvents(),
      flattenBatch(),
      extractEventsWithTx(),
      xcmMessagesSent(api),
      findOutboundHrmpMessage(api, messageControl),
    );
  };
}

function mapXcmpQueueMessage(id: string) {
  return (source: Observable<types.EventWithIdAndTx>):
  Observable<XcmMessageEvent>  => {
    return (source.pipe(
      mongoFilter({
        'section': 'xcmpQueue',
        'method': { $in: ['Success', 'Fail']}
      }),
      map(event => {
        if (event.method === 'Success') {
          const xcmMessage = event.data as any;
          return {
            event,
            messageHash: xcmMessage.messageHash.toHex() as string,
            chainId: id
          } as XcmMessageEvent;
        } else if (event.method === 'Fail') {
          // TODO: implement
          const xcmMessage = event.data as any;
          const error = xcmMessage.error;
          console.log('XCM receive fail not implemented', error);
          return {
            event,
            messageHash: xcmMessage.messageHash.toHex() as string,
            chainId: id
          } as XcmMessageEvent;
        } else {
          return null;
        }
      }),
      filterNonNull()
    )
    );
  };
}

export function extractXcmReceive(chainId: string) {
  return (source: Observable<SignedBlockExtended>)
  : Observable<XcmMessageEvent>  => {
    return (source.pipe(
      extractTxWithEvents(),
      flattenBatch(),
      extractEventsWithTx(),
      mapXcmpQueueMessage(chainId)
    ));
  };
}