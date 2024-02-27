import { mergeMap, map, Observable, filter, bufferCount } from 'rxjs';

// NOTE: we use Polkadot augmented types
import '@polkadot/api-augment/polkadot';
import type { Registry } from '@polkadot/types/types';
import type {
  PolkadotRuntimeParachainsInclusionAggregateMessageOrigin,
  FrameSupportMessagesProcessMessageError
} from '@polkadot/types/lookup';

import type { U8aFixed, bool } from '@polkadot/types-codec';

import {
  ControlQuery,
  filterNonNull,
  types
} from '@sodazone/ocelloids';

import {
  GenericXcmInboundWithContext,
  GenericXcmSentWithContext,
  XcmCriteria,
  XcmInboundWithContext,
  XcmSentWithContext
} from '../types.js';
import { GetOutboundUmpMessages } from '../types-augmented.js';
import { getMessageId, getParaIdFromOrigin, mapAssetsTrapped, matchEvent } from './util.js';
import { asVersionedXcm } from './xcm-format.js';
import { matchMessage, matchSenders } from './criteria.js';

const METHODS_MQ_PROCESSED = ['Processed','ProcessingFailed'];

type UmpReceivedContext = {
  id: U8aFixed,
  origin: PolkadotRuntimeParachainsInclusionAggregateMessageOrigin,
  success?: bool,
  error?: FrameSupportMessagesProcessMessageError
};

function createUmpReceivedWithContext(
  subOrigin: string,
  event: types.BlockEvent,
  assetsTrappedEvent?: types.BlockEvent
): XcmInboundWithContext | null {
  const { id, origin, success, error } = event.data as unknown as UmpReceivedContext;
  // Received event only emits field `message_id`,
  // which is actually the message hash in the current runtime.
  const messageId = id.toHex();
  const messageHash = messageId;
  const messageOrigin = getParaIdFromOrigin(origin);
  const assetsTrapped = mapAssetsTrapped(assetsTrappedEvent);
  // If we can get message origin, only return message if origin matches with subscription origin
  // If no origin, we will return the message without matching with subscription origin
  if (messageOrigin === undefined || messageOrigin === subOrigin) {
    return new GenericXcmInboundWithContext({
      event: event.toHuman(),
      blockHash: event.blockHash.toHex(),
      blockNumber: event.blockNumber.toPrimitive(),
      messageHash,
      messageId,
      outcome: success?.isTrue ? 'Success' : 'Fail',
      error: error ? error.toHuman() : null,
      assetsTrapped
    });
  }
  return null;
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
          messageHash: xcmMessage.messageHash?.toHex(),
          messageId: xcmMessage.messageId?.toHex(),
          sender: event.extrinsic?.signer.toHuman()
        } as XcmSentWithContext;
      })
    ));
  };
}

function findOutboundUmpMessage(
  messageControl: ControlQuery,
  getOutboundUmpMessages: GetOutboundUmpMessages,
  registry: Registry
) {
  return (source: Observable<XcmSentWithContext>)
  : Observable<XcmSentWithContext> => {
    return source.pipe(
      mergeMap(sentMsg => {
        const { blockHash, messageHash, messageId } = sentMsg;
        return getOutboundUmpMessages(blockHash).pipe(
          map(messages =>  {
            return messages
              .map(data => {
                const xcmProgram = asVersionedXcm(data, registry);
                return new GenericXcmSentWithContext({
                  ...sentMsg,
                  messageData: data.toU8a(),
                  recipient: '0', // always relay
                  messageHash: xcmProgram.hash.toHex(),
                  messageId: getMessageId(xcmProgram),
                  instructions: {
                    bytes: xcmProgram.toU8a(),
                    json: xcmProgram.toHuman()
                  }
                });
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

export function extractUmpSend(
  {
    sendersControl,
    messageControl
  }: XcmCriteria,
  getOutboundUmpMessages: GetOutboundUmpMessages,
  registry: Registry
) {
  return (source: Observable<types.BlockEvent>)
      : Observable<XcmSentWithContext> => {
    return source.pipe(
      filter(event => ((
        matchEvent(event, 'parachainSystem', 'UpwardMessageSent')
        || matchEvent(event, 'polkadotXcm', 'Sent')
      ) && matchSenders(sendersControl, event.extrinsic)
      )),
      umpMessagesSent(),
      findOutboundUmpMessage(
        messageControl,
        getOutboundUmpMessages,
        registry
      )
    );
  };
}

export function extractUmpReceive(originId: string) {
  return (source: Observable<types.BlockEvent>)
    : Observable<XcmInboundWithContext>  => {
    return (source.pipe(
      bufferCount(2,1),
      map(([maybeAssetTrapEvent, maybeUmpEvent]) => {
        if (
          maybeUmpEvent &&
          matchEvent(maybeUmpEvent, 'messageQueue', METHODS_MQ_PROCESSED))
        {
          const assetTrapEvent =
            matchEvent(maybeAssetTrapEvent, 'xcmPallet', 'AssetsTrapped') ?
              maybeAssetTrapEvent :
              undefined;
          return createUmpReceivedWithContext(
            originId,
            maybeUmpEvent,
            assetTrapEvent
          );
        }
        return null;
      }),
      filterNonNull()
    ));
  };
}

