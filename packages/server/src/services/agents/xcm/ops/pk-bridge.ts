import { HexString, NetworkURN } from '@/lib.js'
import { BlockEvent, SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { Observable, filter, from, mergeMap } from 'rxjs'
import { GetOutboundPKBridgeMessages } from '../types/common.js'
import { GenericXcmBridgeAcceptedWithContext, XcmBridgeAcceptedWithContext, XcmBridgeInboundWithContext } from '../types/messages.js'
import { matchEvent, networkIdFromInteriorLocation } from './util.js'
import { fromPKBridgeOutboundMessageFormat } from './xcm-format.js'

export const pkBridgePallets: Record<NetworkURN, string> = {
  'urn:ocn:polkadot:1002': 'BridgeKusamaMessages',
  'urn:ocn:kusama:1002': 'BridgePolkadotMessages',
}

export function extractBridgeMessageAccepted(
  origin: NetworkURN,
  getOutboundPKBridgeMessages: GetOutboundPKBridgeMessages,
  context: SubstrateApiContext,
) {
  return (source: Observable<BlockEvent>): Observable<XcmBridgeAcceptedWithContext> => {
    const pallet = pkBridgePallets[origin]
    return source.pipe(
      filter((event) => matchEvent(event, pallet, 'MessageAccepted')),
      mergeMap((blockEvent) => {
        const { lane_id, nonce } = blockEvent.value as { lane_id: HexString; nonce: number }

        return getOutboundPKBridgeMessages(blockEvent.blockHash as HexString, lane_id, nonce).pipe(
          mergeMap(({ key, value }) => {
            const msgs: XcmBridgeAcceptedWithContext[] = []
            const bridgeMessages = fromPKBridgeOutboundMessageFormat(value.asBytes(), context)

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
                extrinsicPosition: blockEvent.extrinsicPosition,
                messageData,
                recipient,
                messageHash: hash,
                instructions: xcm,
                messageId: id,
                forwardId: id,
                bridgeKey: key,
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
