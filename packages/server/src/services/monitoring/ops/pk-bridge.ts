import { Observable, switchMap, mergeMap, filter, from } from 'rxjs';
import type { Registry } from '@polkadot/types/types';
import type { u64, U8aFixed } from '@polkadot/types-codec';
import { blake2AsU8a } from '@polkadot/util-crypto';
import { u8aConcat, compactFromU8aLim, u8aToHex, hexToU8a } from '@polkadot/util';

import { types } from '@sodazone/ocelloids-sdk';

import { GenericXcmBridgeSentWithContext, HexString } from '../types.js';
import { getMessageId, getSendersFromEvent, matchEvent, networkIdFromInteriorLocation } from './util.js';
import { GetStorageAt } from '../types-augmented.js';
import { getConsensus } from '../../config.js';
import { NetworkURN } from '../../types.js';
import { bridgeStorageKeys } from '../storage.js';
import { BridgeMessage } from './xcm-types.js';

export function extractBridgeSend(origin: NetworkURN, registry: Registry, getStorage: GetStorageAt) {
  return (source: Observable<types.BlockEvent>): Observable<GenericXcmBridgeSentWithContext> => {
    return source.pipe(
      filter(
        (event) =>
          matchEvent(event, 'bridgePolkadotMessages', 'MessagesDelivered') ||
          matchEvent(event, 'bridgeKusamaMessages', 'MessagesDelivered')
      ),
      mergeMap((blockEvent) => {
        const data = blockEvent.data as unknown as {
          laneId: U8aFixed;
          messages: {
            end: u64;
            begin: u64;
          };
        };
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

                const msgs: GenericXcmBridgeSentWithContext[] = [];
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

                  const xcmBridgeSent = new GenericXcmBridgeSentWithContext({
                    event: blockEvent.toHuman(),
                    sender: getSendersFromEvent(blockEvent),
                    blockHash: blockEvent.blockHash.toHex(),
                    blockNumber: blockEvent.blockNumber.toPrimitive(),
                    extrinsicId: blockEvent.extrinsicId,
                    messageData: xcmProgram.toU8a(),
                    recipient,
                    messageHash: xcmProgram.hash.toHex(),
                    instructions: {
                      bytes: xcmProgram.toU8a(),
                      json: xcmProgram.toHuman(),
                    },
                    messageId: getMessageId(xcmProgram),
                    bridgeKey: u8aToHex(hexToU8a(key).slice(48)),
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
