import type { Bytes, Vec } from '@polkadot/types-codec'
import type { Registry } from '@polkadot/types/types'
import { compactFromU8aLim, hexToU8a, stringToU8a, u8aConcat, u8aToHex } from '@polkadot/util'
import { blake2AsU8a } from '@polkadot/util-crypto'
import { blake2AsHex } from '@polkadot/util-crypto'
import { Observable, filter, from, mergeMap } from 'rxjs'

import { types } from '@sodazone/ocelloids-sdk'

import { getConsensus } from '../../../config.js'
import { bridgeStorageKeys } from '../../../subscriptions/storage.js'
import { HexString } from '../../../subscriptions/types.js'
import { NetworkURN } from '../../../types.js'
import { GetStorageAt } from '../types-augmented.js'
import {
  GenericXcmBridgeAcceptedWithContext,
  GenericXcmBridgeDeliveredWithContext,
  GenericXcmBridgeInboundWithContext,
  XcmBridgeAcceptedWithContext,
  XcmBridgeDeliveredWithContext,
  XcmBridgeInboundWithContext,
} from '../types.js'
import { blockEventToHuman } from './common.js'
import { getMessageId, getSendersFromEvent, matchEvent, networkIdFromInteriorLocation } from './util.js'
import {
  BpMessagesReceivedMessages,
  BridgeMessage,
  BridgeMessageAccepted,
  BridgeMessagesDelivered,
} from './xcm-types.js'

export function extractBridgeMessageAccepted(origin: NetworkURN, registry: Registry, getStorage: GetStorageAt) {
  return (source: Observable<types.BlockEvent>): Observable<XcmBridgeAcceptedWithContext> => {
    return source.pipe(
      filter((event) =>
        matchEvent(
          event,
          ['bridgePolkadotMessages', 'bridgeKusamaMessages', 'bridgeRococoMessages', 'bridgeWestendMessages'],
          'MessageAccepted'
        )
      ),
      mergeMap((blockEvent) => {
        const data = blockEvent.data as unknown as BridgeMessageAccepted
        const laneId = data.laneId.toU8a()
        const nonce = data.nonce.toU8a()
        const consensus = getConsensus(origin)
        const { messagesOutboundPartial } = bridgeStorageKeys[consensus]

        const value = u8aConcat(laneId, nonce)

        const arg = u8aConcat(blake2AsU8a(value, 128), value)
        const key = (messagesOutboundPartial + Buffer.from(arg).toString('hex')) as HexString

        return getStorage(blockEvent.blockHash.toHex(), key).pipe(
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
              })
            }

            const msgs: XcmBridgeAcceptedWithContext[] = []

            // we use the length of the u8 array instead of Option
            // since the value is bare.
            if (buf.length > 1) {
              const bytes = registry.createType('Bytes', buf) as unknown as Bytes
              let baseOffset = 0

              while (baseOffset < bytes.length) {
                const [offset, length] = compactFromU8aLim(bytes.slice(baseOffset))
                const increment = offset + length
                const msgBuf = bytes.slice(baseOffset + offset, baseOffset + increment)
                baseOffset += increment

                const bridgeMessage = registry.createType('BridgeMessage', msgBuf) as unknown as BridgeMessage
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
          })
        )
      })
    )
  }
}

export function extractBridgeMessageDelivered(origin: NetworkURN, registry: Registry) {
  return (source: Observable<types.BlockEvent>): Observable<XcmBridgeDeliveredWithContext> => {
    return source.pipe(
      filter((event) =>
        matchEvent(
          event,
          ['bridgePolkadotMessages', 'bridgeKusamaMessages', 'bridgeRococoMessages', 'bridgeWestendMessages'],
          'MessagesDelivered'
        )
      ),
      mergeMap((blockEvent) => {
        const data = blockEvent.data as unknown as BridgeMessagesDelivered
        const begin = data.messages.begin.toNumber()
        const end = data.messages.end.toNumber()
        const laneId = data.laneId.toU8a()
        const msgs: XcmBridgeDeliveredWithContext[] = []

        for (let i = begin; i <= end; i++) {
          const nonce = registry.createType('u64', i)
          const value = u8aConcat(laneId, nonce.toU8a())

          const bridgeKey = u8aToHex(value)
          msgs.push(
            new GenericXcmBridgeDeliveredWithContext({
              chainId: origin,
              bridgeKey,
              event: blockEventToHuman(blockEvent),
              extrinsicId: blockEvent.extrinsicId,
              blockNumber: blockEvent.blockNumber.toPrimitive(),
              blockHash: blockEvent.blockHash.toHex(),
              sender: getSendersFromEvent(blockEvent),
            })
          )
        }

        return from(msgs)
      })
    )
  }
}

export function extractBridgeReceive(origin: NetworkURN) {
  return (source: Observable<types.BlockEvent>): Observable<XcmBridgeInboundWithContext> => {
    return source.pipe(
      filter((event) =>
        matchEvent(
          event,
          ['bridgePolkadotMessages', 'bridgeKusamaMessages', 'bridgeRococoMessages', 'bridgeWestendMessages'],
          'MessagesReceived'
        )
      ),
      mergeMap((event) => {
        // for some reason the Vec is wrapped with another array?
        // TODO: investigate for cases of multiple lanes
        const receivedMessages = event.data[0] as unknown as Vec<BpMessagesReceivedMessages>
        const inboundMsgs: XcmBridgeInboundWithContext[] = []
        for (const message of receivedMessages) {
          const laneId = message.lane
          for (const [nonce, result] of message.receiveResults) {
            const key = u8aConcat(laneId.toU8a(), nonce.toU8a())
            inboundMsgs.push(
              new GenericXcmBridgeInboundWithContext({
                chainId: origin,
                bridgeKey: u8aToHex(key),
                event: blockEventToHuman(event),
                extrinsicId: event.extrinsicId,
                blockNumber: event.blockNumber.toPrimitive(),
                blockHash: event.blockHash.toHex(),
                outcome: result.isDispatched ? 'Success' : 'Fail',
                error: result.isDispatched ? null : result.type,
              })
            )
          }
        }
        return from(inboundMsgs)
      })
    )
  }
}
