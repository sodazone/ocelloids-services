import { map, Observable, mergeMap } from 'rxjs';

import type { SignedBlockExtended } from '@polkadot/api-derive/types';

import {
  ControlQuery,
  filterEvents, filterNonNull,
  mongoFilter, types
} from '@sodazone/ocelloids';

import {
  GenericXcmReceivedWithContext,
  GenericXcmSentWithContext, XcmCriteria, XcmReceivedWithContext,
  XcmSentWithContext
} from '../types.js';
import { GetOutboundHrmpMessages } from '../types.js';
import { getMessageId } from './util.js';
import { fromXcmpFormat } from './xcm-format.js';

function findOutboundHrmpMessage(
  messageControl: ControlQuery,
  getOutboundHrmpMessages: GetOutboundHrmpMessages
) {
  return (source: Observable<XcmSentWithContext>)
  : Observable<GenericXcmSentWithContext> => {
    return source.pipe(
      mergeMap((sentMsg): Observable<GenericXcmSentWithContext> => {
        const { blockHash, messageHash, messageId } = sentMsg;
        return getOutboundHrmpMessages(blockHash).pipe(
          map(messages =>  {
            return messages
              .flatMap(msg => {
                const {data, recipient} = msg;
                // TODO: caching strategy
                const xcms = fromXcmpFormat(data);
                return xcms.map(xcmProgram =>
                  new GenericXcmSentWithContext({
                    ...sentMsg,
                    messageData: xcmProgram.toU8a(),
                    recipient: recipient.toNumber().toString(),
                    messageHash: xcmProgram.hash.toHex(),
                    instructions: xcmProgram.toHuman(),
                    messageId: getMessageId(xcmProgram)
                  }));
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

// TODO: duplicate in UMP, extract and reuse?
function xcmpMessagesSent() {
  return (source: Observable<types.BlockEvent>)
    : Observable<XcmSentWithContext> => {
    return (source.pipe(
      map(event => {
        const xcmMessage = event.data as any;
        return {
          event: event.toHuman(),
          sender: event.extrinsic?.signer.toHuman(),
          blockHash: event.blockHash.toHex(),
          blockNumber: event.blockNumber.toPrimitive(),
          extrinsicId: event.extrinsicId,
          messageHash: xcmMessage.messageHash?.toHex(),
          messageId: xcmMessage.messageId?.toHex(),
        } as XcmSentWithContext;
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
  : Observable<XcmSentWithContext> => {
    return source.pipe(
      filterEvents({
        $or: [
          {
            'section': 'xcmpQueue',
            'method': 'XcmpMessageSent'
          },
          {
            'section': 'polkadotXcm',
            'method': 'Sent'
          }
        ]
      }),
      mongoFilter(sendersControl),
      xcmpMessagesSent(),
      findOutboundHrmpMessage(messageControl, getOutboundHrmpMessages),
    );
  };
}

export function extractXcmpReceive() {
  return (source: Observable<SignedBlockExtended>)
  : Observable<XcmReceivedWithContext>  => {
    return (source.pipe(
      filterEvents(
        {
          'section': 'xcmpQueue',
          'method': { $in: ['Success', 'Fail'] }
        }
      ),
      map(event => {
        const xcmMessage = event.data as any;
        
        return new GenericXcmReceivedWithContext({
          event: event.toHuman(),
          blockHash: event.blockHash.toHex(),
          blockNumber: event.blockNumber.toPrimitive(),
          extrinsicId: event.extrinsicId,
          messageHash: xcmMessage.messageHash.toHex(),
          outcome: event.method === 'Success' ? 'Success' : 'Fail',
          error: xcmMessage.error
        });
      })
    ));
  };
}