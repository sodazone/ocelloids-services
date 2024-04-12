import { Observable, switchMap, mergeMap, filter, from } from 'rxjs';
import type { Registry } from '@polkadot/types/types';
import type { Vec } from '@polkadot/types-codec';
import { blake2AsU8a } from '@polkadot/util-crypto';
import { u8aConcat, compactFromU8aLim, u8aToHex, hexToU8a, stringToU8a } from '@polkadot/util';
import { blake2AsHex } from '@polkadot/util-crypto';

import { types } from '@sodazone/ocelloids-sdk';

import {
  GenericXcmBridgeInboundWithContext,
  GenericXcmBridgeSentWithContext,
  HexString,
  XcmBridgeInboundWithContext,
  XcmBridgeSentWithContext,
} from '../types.js';
import { getMessageId, getSendersFromEvent, matchEvent, networkIdFromInteriorLocation } from './util.js';
import { GetStorageAt } from '../types-augmented.js';
import { getConsensus } from '../../config.js';
import { NetworkURN } from '../../types.js';
import { bridgeStorageKeys } from '../storage.js';
import { BpMessagesReceivedMessages, BridgeMessage, BridgeMessagesDelivered } from './xcm-types.js';

export function extractBridgeSend(origin: NetworkURN, registry: Registry, getStorage: GetStorageAt) {
  return (source: Observable<types.BlockEvent>): Observable<XcmBridgeSentWithContext> => {
    return source.pipe(
      filter(
        (event) =>
          matchEvent(event, 'bridgePolkadotMessages', 'MessagesDelivered') ||
          matchEvent(event, 'bridgeKusamaMessages', 'MessagesDelivered')
      ),
      mergeMap((blockEvent) => {
        const data = blockEvent.data as unknown as BridgeMessagesDelivered;
        const begin = data.messages.begin.toNumber();
        const end = data.messages.end.toNumber();
        const laneId = data.laneId.toU8a();
        const consensus = getConsensus(origin);
        const { messagesOutboundPartial } = bridgeStorageKeys[consensus];
        const storageKeys: HexString[] = [];

        for (let i = begin; i <= end; i++) {
          const nonce = registry.createType('u64', i);
          const value = u8aConcat(laneId, nonce.toU8a());

          const arg = u8aConcat(blake2AsU8a(value, 128), value);
          const key = (messagesOutboundPartial + Buffer.from(arg).toString('hex')) as HexString;

          storageKeys.push(key);
        }

        return from(storageKeys).pipe(
          switchMap((key) =>
            getStorage(blockEvent.blockHash.toHex(), key).pipe(
              mergeMap((buf) => {
                // if registry does not have needed types, register them
                if (!registry.hasType('BridgeMessage')) {
                  registry.register({
                    VersionedInteriorLocation: {
                      _enum: {
                        V0: null,
                        V1: null,
                        V2: 'XcmV2MultilocationJunctions',
                        V3: 'XcmV3Junctions',
                      },
                    },
                    BridgeMessage: {
                      universal_dest: 'VersionedInteriorLocation',
                      message: 'XcmVersionedXcm',
                    },
                  });
                }

                const msgs: XcmBridgeSentWithContext[] = [];
                let baseOffset = 0;
                while (baseOffset < buf.length) {
                  const [offset, length] = compactFromU8aLim(buf.slice(baseOffset));
                  const increment = offset + length;
                  const msgBuf = buf.slice(baseOffset + offset, baseOffset + increment);
                  baseOffset += increment;

                  const bridgeMessage = registry.createType('BridgeMessage', msgBuf) as unknown as BridgeMessage;
                  const recipient = networkIdFromInteriorLocation(bridgeMessage.universal_dest);
                  if (recipient === undefined) {
                    continue;
                  }
                  const xcmProgram = bridgeMessage.message;
                  const messageId = getMessageId(xcmProgram);
                  let forwardId: HexString | undefined;
                  if (messageId !== undefined) {
                    const constant = 'forward_id_for';
                    const derivedIdBuf = u8aConcat(stringToU8a(constant), hexToU8a(messageId));
                    forwardId = blake2AsHex(derivedIdBuf);
                  }

                  const xcmBridgeSent = new GenericXcmBridgeSentWithContext({
                    event: blockEvent.toHuman(),
                    sender: getSendersFromEvent(blockEvent),
                    blockHash: blockEvent.blockHash.toHex(),
                    blockNumber: blockEvent.blockNumber.toPrimitive(),
                    extrinsicId: blockEvent.extrinsicId,
                    messageData: xcmProgram.toHex(),
                    recipient,
                    messageHash: xcmProgram.hash.toHex(),
                    instructions: xcmProgram.toHuman(),
                    messageId,
                    forwardId,
                    bridgeKey: u8aToHex(hexToU8a(key).slice(48)),
                    chainId: origin,
                  });

                  msgs.push(xcmBridgeSent);
                }
                return from(msgs);
              })
            )
          )
        );
      })
    );
  };
}

export function extractBridgeReceive(origin: NetworkURN) {
  return (source: Observable<types.BlockEvent>): Observable<XcmBridgeInboundWithContext> => {
    return source.pipe(
      filter(
        (event) =>
          matchEvent(event, 'bridgePolkadotMessages', 'MessagesReceived') ||
          matchEvent(event, 'bridgeKusamaMessages', 'MessagesReceived')
      ),
      mergeMap((event) => {
        // for some reason the Vec is wrapped with another array?
        // TODO: investigate for cases of multiple lanes
        const receivedMessages = event.data[0] as unknown as Vec<BpMessagesReceivedMessages>;
        const inboundMsgs: XcmBridgeInboundWithContext[] = [];
        for (const message of receivedMessages) {
          const laneId = message.lane;
          for (const [nonce, result] of message.receiveResults) {
            const key = u8aConcat(laneId.toU8a(), nonce.toU8a());
            inboundMsgs.push(
              new GenericXcmBridgeInboundWithContext({
                chainId: origin,
                bridgeKey: u8aToHex(key),
                event: event.toHuman(),
                extrinsicId: event.extrinsicId,
                blockNumber: event.blockNumber.toPrimitive(),
                blockHash: event.blockHash.toHex(),
                outcome: result.isDispatched ? 'Success' : 'Fail',
                error: result.isDispatched ? null : result.type,
              })
            );
          }
        }
        return from(inboundMsgs);
      })
    );
  };
}
