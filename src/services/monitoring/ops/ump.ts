import type { } from '@polkadot/api-augment';

import { mergeMap, map, Observable } from 'rxjs';

import type { SignedBlockExtended } from '@polkadot/api-derive/types';
import type { EventRecord } from '@polkadot/types/interfaces';

import {
  ControlQuery,
  filterEvents, filterNonNull,
  mongoFilter, types
} from '@sodazone/ocelloids';

import {
  GenericXcmReceivedWithContext,
  GenericXcmSentWithContext,
  GetOutboundUmpMessages,
  HexString,
  XcmCriteria, XcmReceivedWithContext,
  XcmSentWithContext
} from '../types.js';
import { getMessageId } from './util.js';
import { asVersionedXcm } from './xcm-format.js';

type EventRecordWithContext = {
  record: EventRecord,
  method: string,
  section: string,
  blockNumber: string,
  blockHash: HexString
}

function mapUmpQueueMessage(origin: string) {
  return (source: Observable<EventRecordWithContext>):
    Observable<XcmReceivedWithContext>  => {
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
        const originId = messageOrigin?.Ump?.Para?.replaceAll(',', '');
        // If we can get origin ID, only return message if origin matches with subscription origin
        // If no origin ID, we will return the message without matching with subscription origin
        if (originId === undefined || originId === origin) {
          return new GenericXcmReceivedWithContext({
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
          messageHash: xcmMessage.messageHash.toHex(),
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
        const { blockHash, messageHash } = sentMsg;
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
        'section': 'parachainSystem',
        'method': 'UpwardMessageSent'
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

export function extractUmpReceive(origin: string) {
  return (source: Observable<SignedBlockExtended>)
    : Observable<XcmReceivedWithContext>  => {
    return (source.pipe(
      mergeMap(({ block: { header }, events}) =>
        events.map(record => ({
          record,
          method: record.event.method,
          section: record.event.section,
          blockNumber: header.number.toPrimitive(),
          blockHash: header.hash.toHex()
        } as EventRecordWithContext)
        )),
      mapUmpQueueMessage(origin)
    ));
  };
}

