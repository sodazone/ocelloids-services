import { filter, from, mergeMap, Observable } from 'rxjs'
import { HexString, NetworkURN } from '@/lib.js'
import { BlockEvent, SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { GetOutboundPKBridgeMessages } from '../types/common.js'
import {
  GenericXcmBridgeAcceptedWithContext,
  GenericXcmBridgeInboundWithContext,
  XcmBridgeAcceptedWithContext,
  XcmBridgeInboundWithContext,
} from '../types/messages.js'
import { matchEvent, networkIdFromInteriorLocation } from './util.js'
import { fromPKBridgeOutboundMessageFormat } from './xcm-format.js'

export type PkBridgeConfig = {
  destination: NetworkURN
  pallet: string
}

export const pkBridgeConfig: Record<NetworkURN, PkBridgeConfig> = {
  'urn:ocn:polkadot:1002': {
    destination: 'urn:ocn:kusama:1002',
    pallet: 'BridgeKusamaMessages',
  },
  'urn:ocn:kusama:1002': {
    destination: 'urn:ocn:polkadot:1002',
    pallet: 'BridgePolkadotMessages',
  },
}

export function extractBridgeMessageAccepted(
  origin: NetworkURN,
  getOutboundPKBridgeMessages: GetOutboundPKBridgeMessages,
  context: SubstrateApiContext,
) {
  return (source: Observable<BlockEvent>): Observable<XcmBridgeAcceptedWithContext> => {
    const config = pkBridgeConfig[origin]
    return source.pipe(
      filter((event) => matchEvent(event, config.pallet, 'MessageAccepted')),
      mergeMap((blockEvent) => {
        const { lane_id, nonce } = blockEvent.value as { lane_id: HexString; nonce: number }

        return getOutboundPKBridgeMessages(blockEvent.blockHash as HexString, lane_id, nonce).pipe(
          mergeMap((msgBuf) => {
            const msgs: XcmBridgeAcceptedWithContext[] = []
            const bridgeMessages = fromPKBridgeOutboundMessageFormat(msgBuf.asBytes(), context)

            for (const { destination, xcm, id, hash, messageData } of bridgeMessages) {
              const recipient = networkIdFromInteriorLocation(destination.value)
              if (recipient === undefined) {
                continue
              }
              const xcmBridgeSent = new GenericXcmBridgeAcceptedWithContext({
                event: blockEvent,
                blockHash: blockEvent.blockHash as HexString,
                blockNumber: blockEvent.blockNumber,
                timestamp: blockEvent.timestamp,
                txPosition: blockEvent.extrinsic?.blockPosition,
                txHash: blockEvent.extrinsic?.hash as HexString,
                messageData,
                recipient,
                messageHash: hash,
                instructions: xcm,
                messageId: id,
                channelId: lane_id,
                nonce: nonce.toString(),
                chainId: origin,
              })

              msgs.push(xcmBridgeSent)
            }

            return from(msgs)
          }),
        )
      }),
    )
  }
}

export function extractBridgeReceive(origin: NetworkURN) {
  return (source: Observable<BlockEvent>): Observable<XcmBridgeInboundWithContext> => {
    const config = pkBridgeConfig[origin]
    return source.pipe(
      filter((event) => matchEvent(event, config.pallet, 'MessagesReceived')),
      mergeMap((event) => {
        const { lane, receive_results } = event.value as {
          lane: HexString
          receive_results: [nonce: string, dispatch: any][]
        }
        const inboundMsgs: XcmBridgeInboundWithContext[] = []
        for (const [nonce, result] of receive_results) {
          inboundMsgs.push(
            new GenericXcmBridgeInboundWithContext({
              chainId: origin,
              channelId: lane,
              nonce: nonce.toString(),
              event,
              txPosition: event.extrinsic?.blockPosition,
              txHash: event.extrinsic?.hash as HexString,
              blockNumber: event.blockNumber,
              blockHash: event.blockHash as HexString,
              timestamp: event.timestamp,
              outcome: result.type === 'Dispatched' ? 'Success' : 'Fail',
              error: result.type === 'Dispatched' ? null : result.value,
            }),
          )
        }
        return from(inboundMsgs)
      }),
    )
  }
}
