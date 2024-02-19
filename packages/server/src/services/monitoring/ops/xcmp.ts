import { map, Observable, mergeMap, filter, bufferCount } from 'rxjs';

import {
  ControlQuery,
  filterNonNull,
  types
} from '@sodazone/ocelloids';

import {
  GenericXcmReceivedWithContext,
  GenericXcmSentWithContext,
  XcmCriteria,
  XcmReceivedWithContext,
  XcmSentWithContext
} from '../types.js';
import { GetOutboundHrmpMessages } from '../types.js';
import { getMessageId, mapAssetsTrapped, matchEvent } from './util.js';
import { fromXcmpFormat } from './xcm-format.js';
import { matchMessage, matchSenders } from './criteria.js';

const METHODS_XCMP_QUEUE = ['Success', 'Fail'];

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
                    instructions: xcmProgram,
                    messageId: getMessageId(xcmProgram)
                  }));
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
  return (source: Observable<types.BlockEvent>)
  : Observable<XcmSentWithContext> => {
    return source.pipe(
      filter(event => (
        (matchEvent(event, 'xcmpQueue', 'XcmpMessageSent')
        || matchEvent(event, 'polkadotXcm', 'Sent'))
        && matchSenders(sendersControl, event.extrinsic)
      )),
      xcmpMessagesSent(),
      findOutboundHrmpMessage(messageControl, getOutboundHrmpMessages),
    );
  };
}

export function extractXcmpReceive() {
  return (source: Observable<types.BlockEvent>)
  : Observable<XcmReceivedWithContext>  => {
    return (source.pipe(
      bufferCount(2,1),
      map(([maybeAssetTrapEvent, maybeXcmpEvent]) => {
        if (
          maybeXcmpEvent &&
          matchEvent(maybeXcmpEvent, 'xcmpQueue', METHODS_XCMP_QUEUE)
        ) {
          const xcmMessage = maybeXcmpEvent.data as any;
          const assetTrapEvent =
            matchEvent(maybeAssetTrapEvent, 'xcmPallet', 'AssetsTrapped') ?
              maybeAssetTrapEvent :
              undefined;
          const assetsTrapped = mapAssetsTrapped(assetTrapEvent);

          return new GenericXcmReceivedWithContext({
            event: maybeXcmpEvent.toHuman(),
            blockHash: maybeXcmpEvent.blockHash.toHex(),
            blockNumber: maybeXcmpEvent.blockNumber.toPrimitive(),
            extrinsicId: maybeXcmpEvent.extrinsicId,
            messageHash: xcmMessage.messageHash.toHex(),
            outcome: maybeXcmpEvent.method === 'Success' ? 'Success' : 'Fail',
            error: xcmMessage.error,
            assetsTrapped
          });
        }

        return null;
      }),
      filterNonNull()
    ));
  };
}