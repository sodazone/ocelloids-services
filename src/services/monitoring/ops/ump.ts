import type { } from '@polkadot/api-augment';

import { mergeMap, map, Observable } from 'rxjs';

import type { SignedBlockExtended } from '@polkadot/api-derive/types';
import type { EventRecord } from '@polkadot/types/interfaces';
import { ApiPromise } from '@polkadot/api';

import {
  ControlQuery,
  filterEvents, filterNonNull,
  mongoFilter, types
} from '@sodazone/ocelloids';

import {
  GenericXcmMessageReceivedWithContext,
  GenericXcmMessageSentWithContext,
  GetOutboundUmpMessages,
  HexString,
  XcmCriteria, XcmMessageReceivedWithContext,
  XcmMessageSentWithContext
} from '../types.js';
import { asVersionedXcm, getMessageId } from './util.js';

type EventRecordWithContext = {
  record: EventRecord,
  method: string,
  section: string,
  blockNumber: string,
  blockHash: HexString
}

function mapUmpQueueMessage(origin: number) {
  return (source: Observable<EventRecordWithContext>):
    Observable<XcmMessageReceivedWithContext>  => {
    return (source.pipe(
      mongoFilter({
        'section': 'messageQueue',
        'method': 'Processed'
      }),
      map(({ record: { event }, blockHash, blockNumber }) => {
        const xcmMessage = event.data as any;
        const messageId = xcmMessage.id.toHex();
        const messageHash = messageId;
        const messageOrigin = xcmMessage.origin.toHuman();
        const originId = messageOrigin?.Ump?.Para?.replace(/,/g, '');
        // If we can get origin ID, only return message if origin matches with subscription origin
        // If no origin ID, we will return the message without matching with subscription origin
        if ((originId && originId === origin.toString()) || !originId) {
          return new GenericXcmMessageReceivedWithContext({
            event: event.toHuman(),
            blockHash,
            blockNumber,
            messageHash,
            messageId,
            outcome: xcmMessage.success.toPrimitive() ? 'Success' : 'Fail',
            error: null
          });
        }
        return null;
      }),
      filterNonNull()
    ));
  };
}

function umpMessagesSent() {
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
          messageHash: xcmMessage.messageHash.toHex(),
          sender: event.extrinsic.signer.toHuman()
        } as XcmMessageSentWithContext;
      })
    ));
  };
}

function findOutboundUmpMessage(
  api: ApiPromise,
  messageControl: ControlQuery,
  getOutboundUmpMessages: GetOutboundUmpMessages
) {
  return (source: Observable<XcmMessageSentWithContext>)
  : Observable<XcmMessageSentWithContext> => {
    return source.pipe(
      mergeMap(sentMsg => {
        const { blockHash, messageHash } = sentMsg;
        return getOutboundUmpMessages(blockHash).pipe(
          map(messages =>  {
            return messages
              .map(data => {
                const xcmProgram = asVersionedXcm(api, data);
                return new GenericXcmMessageSentWithContext({
                  ...sentMsg,
                  messageData: data,
                  recipient: 0, // always relay
                  messageHash: xcmProgram.hash.toHex(),
                  messageId: getMessageId(xcmProgram),
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

export function extractUmpSend(
  api: ApiPromise,
  {
    sendersControl,
    messageControl
  }: XcmCriteria,
  getOutboundUmpMessages: GetOutboundUmpMessages
) {
  return (source: Observable<SignedBlockExtended>)
      : Observable<XcmMessageSentWithContext> => {
    return source.pipe(
      filterEvents(
        // events filter criteria
        {
          'section': 'parachainSystem',
          'method': 'UpwardMessageSent'
        },
        // extrinsics filter criteria
        // NOTE: we are not flattening extrinsics here
        // since we are filtering by events
        {
          'dispatchError': { $eq: undefined }
        }
      ),
      mongoFilter(sendersControl),
      umpMessagesSent(),
      findOutboundUmpMessage(
        api,
        messageControl,
        getOutboundUmpMessages
      )
    );
  };
}

export function extractUmpReceive(origin: number) {
  return (source: Observable<SignedBlockExtended>)
    : Observable<XcmMessageReceivedWithContext>  => {
    return (source.pipe(
      mergeMap(({ block: { header }, events}) =>
        events.map(record => ({
          record,
          method: record.event.method,
          section: record.event.section,
          blockNumber: header.number.toString(),
          blockHash: header.hash.toHex()
        } as EventRecordWithContext)
        )),
      mapUmpQueueMessage(origin)
    ));
  };
}

