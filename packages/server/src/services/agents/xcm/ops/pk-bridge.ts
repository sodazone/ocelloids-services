import type { Bytes, Vec } from '@polkadot/types-codec'
import { compactFromU8aLim, hexToU8a, stringToU8a, u8aConcat, u8aToHex } from '@polkadot/util'
import { blake2AsU8a } from '@polkadot/util-crypto'
import { blake2AsHex } from '@polkadot/util-crypto'
import { Observable, filter, from, mergeMap } from 'rxjs'

import { getConsensus } from '@/services/config.js'
import { ApiContext } from '@/services/networking/client/index.js'
import { BlockEvent } from '@/services/networking/index.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import { asSerializable } from '../../base/util.js'
import { GetStorageAt } from '../types-augmented.js'
import {
  GenericXcmBridgeAcceptedWithContext,
  GenericXcmBridgeDeliveredWithContext,
  GenericXcmBridgeInboundWithContext,
  XcmBridgeAcceptedWithContext,
  XcmBridgeDeliveredWithContext,
  XcmBridgeInboundWithContext,
} from '../types.js'
import { getMessageId, getSendersFromEvent, matchEvent, networkIdFromInteriorLocation } from './util.js'

export function extractBridgeMessageAccepted(
  origin: NetworkURN,
  context: ApiContext,
  getStorage: GetStorageAt,
) {
  return (source: Observable<BlockEvent>): Observable<XcmBridgeAcceptedWithContext> => {
    return source.pipe(
      filter((event) =>
        matchEvent(
          event,
          ['BridgePolkadotMessages', 'BridgeKusamaMessages', 'BridgeRococoMessages', 'BridgeWestendMessages'],
          'MessageAccepted',
        ),
      ),
      mergeMap((blockEvent) => {
        const data = blockEvent.value as unknown as BridgeMessageAccepted
        const laneId = data.laneId.toU8a()
        const nonce = data.nonce.toU8a()
        const consensus = getConsensus(origin)
        const { messagesOutboundPartial } = bridgeStorageKeys[consensus]

        const value = u8aConcat(laneId, nonce)

        const arg = u8aConcat(blake2AsU8a(value, 128), value)
        const key = (messagesOutboundPartial + Buffer.from(arg).toString('hex')) as HexString

        return getStorage(blockEvent.blockHash as HexString, key).pipe(
          mergeMap((buf) => {
            // if registry does not have needed types, register them
            if (!context.hasType('BridgeMessage')) {
              context.register({
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
              })
            }

            const msgs: XcmBridgeAcceptedWithContext[] = []

            // we use the length of the u8 array instead of Option
            // since the value is bare.
            if (buf.length > 1) {
              const bytes = context.createType('Bytes', buf) as unknown as Bytes
              let baseOffset = 0

              while (baseOffset < bytes.length) {
                const [offset, length] = compactFromU8aLim(bytes.slice(baseOffset))
                const increment = offset + length
                const msgBuf = bytes.slice(baseOffset + offset, baseOffset + increment)
                baseOffset += increment

                const bridgeMessage = context.createType('BridgeMessage', msgBuf) as unknown as BridgeMessage
                const recipient = networkIdFromInteriorLocation(bridgeMessage.universal_dest)
                if (recipient === undefined) {
                  continue
                }
                const xcmProgram = bridgeMessage.message
                const messageId = getMessageId(xcmProgram)
                let forwardId: HexString | undefined
                if (messageId !== undefined) {
                  const constant = 'forward_id_for'
                  const derivedIdBuf = u8aConcat(stringToU8a(constant), hexToU8a(messageId))
                  forwardId = blake2AsHex(derivedIdBuf)
                }

                const xcmBridgeSent = new GenericXcmBridgeAcceptedWithContext({
                  event: blockEvent.toHuman(),
                  blockHash: blockEvent.blockHash.toHex(),
                  blockNumber: blockEvent.blockNumber.toPrimitive(),
                  timestamp: blockEvent.timestamp?.toNumber(),
                  extrinsicId: blockEvent.extrinsicId,
                  messageData: xcmProgram.toHex(),
                  recipient,
                  messageHash: xcmProgram.hash.toHex(),
                  instructions: xcmProgram.toHuman(),
                  messageId,
                  forwardId,
                  bridgeKey: u8aToHex(hexToU8a(key).slice(48)),
                  chainId: origin,
                })

                msgs.push(xcmBridgeSent)
              }
            }
            return from(msgs)
          }),
        )
      }),
    )
  }
}

export function extractBridgeMessageDelivered(origin: NetworkURN, context: ApiContext) {
  return (source: Observable<BlockEvent>): Observable<XcmBridgeDeliveredWithContext> => {
    return source.pipe(
      filter((event) =>
        matchEvent(
          event,
          ['BridgePolkadotMessages', 'BridgeKusamaMessages', 'BridgeRococoMessages', 'BridgeWestendMessages'],
          'MessagesDelivered',
        ),
      ),
      mergeMap((blockEvent) => {
        const data = blockEvent.value as unknown as BridgeMessagesDelivered
        const begin = data.messages.begin.toNumber()
        const end = data.messages.end.toNumber()
        const laneId = data.laneId.toU8a()
        const msgs: XcmBridgeDeliveredWithContext[] = []

        for (let i = begin; i <= end; i++) {
          const nonce = context.createType('u64', i)
          const value = u8aConcat(laneId, nonce.toU8a())

          const bridgeKey = u8aToHex(value)
          msgs.push(
            new GenericXcmBridgeDeliveredWithContext({
              chainId: origin,
              bridgeKey,
              event: asSerializable(blockEvent),
              extrinsicPosition: blockEvent.extrinsicPosition,
              blockNumber: blockEvent.blockNumber,
              blockHash: blockEvent.blockHash as HexString,
              timestamp: blockEvent.timestamp,
              sender: getSendersFromEvent(blockEvent),
            }),
          )
        }

        return from(msgs)
      }),
    )
  }
}

export function extractBridgeReceive(origin: NetworkURN) {
  return (source: Observable<BlockEvent>): Observable<XcmBridgeInboundWithContext> => {
    return source.pipe(
      filter((event) =>
        matchEvent(
          event,
          ['BridgePolkadotMessages', 'BridgeKusamaMessages', 'BridgeRococoMessages', 'BridgeWestendMessages'],
          'MessagesReceived',
        ),
      ),
      mergeMap((event) => {
        // for some reason the Vec is wrapped with another array?
        // TODO: investigate for cases of multiple lanes
        const receivedMessages = event.value[0] as unknown as Vec<BpMessagesReceivedMessages>
        const inboundMsgs: XcmBridgeInboundWithContext[] = []
        for (const message of receivedMessages) {
          const laneId = message.lane
          for (const [nonce, result] of message.receiveResults) {
            const key = u8aConcat(laneId.toU8a(), nonce.toU8a())
            inboundMsgs.push(
              new GenericXcmBridgeInboundWithContext({
                chainId: origin,
                bridgeKey: u8aToHex(key),
                event: asSerializable(event),
                extrinsicPosition: event.extrinsicPosition,
                blockNumber: event.blockNumber,
                blockHash: event.blockHash as HexString,
                timestamp: event.timestamp,
                outcome: result.isDispatched ? 'Success' : 'Fail',
                error: result.isDispatched ? null : result.type,
              }),
            )
          }
        }
        return from(inboundMsgs)
      }),
    )
  }
}
