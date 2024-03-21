import { map, Observable, mergeMap, filter, bufferCount } from 'rxjs';
import type { Registry } from '@polkadot/types/types';

import { ControlQuery, filterNonNull, types } from '@sodazone/ocelloids-sdk';

import {
  GenericXcmInboundWithContext,
  GenericXcmSentWithContext,
  XcmInboundWithContext,
  XcmSentWithContext,
} from '../types.js';
import { getMessageId, getSendersFromEvent, mapAssetsTrapped, matchEvent } from './util.js';
import { fromXcmpFormat } from './xcm-format.js';
import { GetOutboundHrmpMessages } from '../types-augmented.js';
import { createNetworkId } from '../../config.js';
import { NetworkURN } from '../../types.js';

const METHODS_XCMP_QUEUE = ['Success', 'Fail'];

function findOutboundHrmpMessage(
  origin: NetworkURN,
  getOutboundHrmpMessages: GetOutboundHrmpMessages,
  registry: Registry
) {
  return (source: Observable<XcmSentWithContext>): Observable<GenericXcmSentWithContext> => {
    return source.pipe(
      mergeMap((sentMsg): Observable<GenericXcmSentWithContext> => {
        const { blockHash, messageHash, messageId } = sentMsg;
        return getOutboundHrmpMessages(blockHash).pipe(
          map((messages) => {
            return messages
              .flatMap((msg) => {
                const { data, recipient } = msg;
                // TODO: caching strategy
                const xcms = fromXcmpFormat(data, registry);
                return xcms.map(
                  (xcmProgram) =>
                    new GenericXcmSentWithContext({
                      ...sentMsg,
                      messageData: xcmProgram.toU8a(),
                      recipient: createNetworkId(origin, recipient.toNumber().toString()),
                      messageHash: xcmProgram.hash.toHex(),
                      instructions: {
                        bytes: xcmProgram.toU8a(),
                        json: xcmProgram.toHuman(),
                      },
                      messageId: getMessageId(xcmProgram),
                    })
                );
              })
              .find((msg) => {
                return messageId ? msg.messageId === messageId : msg.messageHash === messageHash;
              });
          }),
          filterNonNull()
        );
      })
    );
  };
}

// TODO: duplicate in UMP, extract and reuse?
function xcmpMessagesSent() {
  return (source: Observable<types.BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      map((event) => {
        const xcmMessage = event.data as any;
        return {
          event: event.toHuman(),
          sender: getSendersFromEvent(event),
          blockHash: event.blockHash.toHex(),
          blockNumber: event.blockNumber.toPrimitive(),
          extrinsicId: event.extrinsicId,
          messageHash: xcmMessage.messageHash?.toHex(),
          messageId: xcmMessage.messageId?.toHex(),
        } as XcmSentWithContext;
      })
    );
  };
}

export function extractXcmpSend(
  origin: NetworkURN,
  sendersControl: ControlQuery,
  getOutboundHrmpMessages: GetOutboundHrmpMessages,
  registry: Registry
) {
  return (source: Observable<types.BlockEvent>): Observable<XcmSentWithContext> => {
    return source.pipe(
      filter((event) => matchEvent(event, 'xcmpQueue', 'XcmpMessageSent') || matchEvent(event, 'polkadotXcm', 'Sent')),
      xcmpMessagesSent(),
      findOutboundHrmpMessage(origin, getOutboundHrmpMessages, registry)
    );
  };
}

export function extractXcmpReceive() {
  return (source: Observable<types.BlockEvent>): Observable<XcmInboundWithContext> => {
    return source.pipe(
      bufferCount(2, 1),
      map(([maybeAssetTrapEvent, maybeXcmpEvent]) => {
        if (maybeXcmpEvent && matchEvent(maybeXcmpEvent, 'xcmpQueue', METHODS_XCMP_QUEUE)) {
          const xcmMessage = maybeXcmpEvent.data as any;
          const assetTrapEvent = matchEvent(maybeAssetTrapEvent, 'xcmPallet', 'AssetsTrapped')
            ? maybeAssetTrapEvent
            : undefined;
          const assetsTrapped = mapAssetsTrapped(assetTrapEvent);

          return new GenericXcmInboundWithContext({
            event: maybeXcmpEvent.toHuman(),
            blockHash: maybeXcmpEvent.blockHash.toHex(),
            blockNumber: maybeXcmpEvent.blockNumber.toPrimitive(),
            extrinsicId: maybeXcmpEvent.extrinsicId,
            messageHash: xcmMessage.messageHash.toHex(),
            outcome: maybeXcmpEvent.method === 'Success' ? 'Success' : 'Fail',
            error: xcmMessage.error,
            assetsTrapped,
          });
        }

        return null;
      }),
      filterNonNull()
    );
  };
}
