import { filter, map, Observable } from 'rxjs'
import { Abi } from 'viem'
import { AnyJson, HexString, NetworkURN } from '@/lib.js'
import { createNetworkId } from '@/services/config.js'
import { filterTransactionsWithLogs } from '@/services/networking/evm/rx/extract.js'
import { BlockWithLogs } from '@/services/networking/evm/types.js'
import { BlockEvent } from '@/services/networking/substrate/types.js'
import gatewayAbi from '../abis/gateway-mini.json' with { type: 'json' }
import {
  GenericSnowbridgeInboundWithContext,
  GenericSnowbridgeMessageAccepted,
  GenericSnowbridgeOutboundAccepted,
  SnowbridgeInboundWithContext,
  SnowbridgeMessageAccepted,
  SnowbridgeOutboundAccepted,
} from '../types/messages.js'
import { matchEvent } from './util.js'

type SnowbridgeEvmInboundLog = {
  eventName: string
  args: { channelID: HexString; messageID: HexString; nonce: bigint; success: boolean }
}

type SnowbridgeEvmOutboundAcceptedLog = {
  eventName: string
  args: {
    channelID: HexString
    messageID: HexString
    nonce: bigint
    payload: HexString
  }
}

type SnowbridgeEvmTokenSentLog = {
  eventName: string
  args: {
    token: HexString
    sender: HexString
    destinationChain: number
    destinationAddress: {
      kind: number
      data: HexString
    }
    amount: bigint
  }
}

type SnowbridgeSubstrateReceivedEvent = {
  channel_id: HexString
  message_id: HexString
  nonce: number
  fee_burned: number
}

type SnowbridgeSubstrateAcceptedEvent = {
  id: HexString
  nonce: number
}

function hexTimestampToMillis(hex?: string) {
  if (hex !== undefined && hex.startsWith('0x')) {
    return Number(BigInt(hex) * 1000n)
  }
}

export function extractSnowbridgeEvmInbound(chainId: NetworkURN, contractAddress: HexString) {
  return (source: Observable<BlockWithLogs>): Observable<SnowbridgeInboundWithContext> => {
    return source.pipe(
      filterTransactionsWithLogs({ abi: gatewayAbi as Abi, addresses: [contractAddress] }, ['submitV1']),
      map((tx) => {
        const inboundLog = tx.logs.find(
          (l) => l.decoded && l.decoded.eventName === 'InboundMessageDispatched',
        )
        if (!inboundLog) {
          throw new Error('No InboundMessageDispatched log found in Snowbridge inbound tx.')
        }
        if (tx.blockHash === null || tx.blockNumber === null) {
          throw new Error('No block context data in Snowbridge inbound tx.')
        }

        const {
          args: { channelID, messageID, nonce, success },
        } = inboundLog.decoded as SnowbridgeEvmInboundLog

        return new GenericSnowbridgeInboundWithContext({
          chainId,
          blockHash: tx.blockHash,
          blockNumber: tx.blockNumber.toString(),
          channelId: channelID,
          messageId: messageID,
          nonce: nonce.toString(),
          outcome: success ? 'Success' : 'Fail',
          event: { name: inboundLog.decoded?.eventName, args: inboundLog.decoded?.args } as AnyJson,
          timestamp: hexTimestampToMillis((inboundLog as any)['blockTimestamp']),
          txHash: tx.hash,
          txPosition: tx.transactionIndex ?? undefined,
        })
      }),
    )
  }
}

export function extractSnowbridgeEvmOutbound(chainId: NetworkURN, contractAddress: HexString) {
  return (source: Observable<BlockWithLogs>): Observable<SnowbridgeOutboundAccepted> => {
    return source.pipe(
      filterTransactionsWithLogs({ abi: gatewayAbi as Abi, addresses: [contractAddress] }, ['sendToken']),
      map((tx) => {
        const tokenSentLog = tx.logs.find((l) => l.decoded && l.decoded.eventName === 'TokenSent')
        const acceptedLog = tx.logs.find(
          (l) => l.decoded && l.decoded.eventName === 'OutboundMessageAccepted',
        )
        if (!acceptedLog) {
          throw new Error('No OutboundMessageAccepted log found in Snowbridge outbound tx.')
        }
        if (!tokenSentLog) {
          throw new Error('No TokenSent log found in Snowbridge outbound tx.')
        }
        if (tx.blockHash === null || tx.blockNumber === null) {
          throw new Error('No block context data in Snowbridge inbound tx.')
        }

        const {
          args: { channelID, messageID, nonce, payload },
        } = acceptedLog.decoded as SnowbridgeEvmOutboundAcceptedLog
        const {
          args: { amount, destinationAddress, destinationChain, sender, token },
        } = tokenSentLog.decoded as SnowbridgeEvmTokenSentLog

        return new GenericSnowbridgeOutboundAccepted({
          chainId,
          blockHash: tx.blockHash,
          blockNumber: tx.blockNumber.toString(),
          channelId: channelID,
          messageId: messageID,
          nonce: nonce.toString(),
          payload,
          sender,
          beneficiary: destinationAddress.data,
          recipient: createNetworkId('polkadot', destinationChain.toString()),
          asset: {
            token,
            amount: amount.toString(),
          },
          event: { name: acceptedLog.decoded?.eventName, args: acceptedLog.decoded?.args } as AnyJson,
          timestamp: hexTimestampToMillis((acceptedLog as any)['blockTimestamp']),
          txHash: tx.hash,
          txPosition: tx.transactionIndex ?? undefined,
        })
      }),
    )
  }
}

export function extractSnowbridgeSubstrateInbound(chainId: NetworkURN) {
  return (source: Observable<BlockEvent>): Observable<SnowbridgeInboundWithContext> => {
    return source.pipe(
      filter((event) => matchEvent(event, 'EthereumInboundQueue', 'MessageReceived')),
      map((blockEvent) => {
        const { channel_id, message_id, nonce } = blockEvent.value as SnowbridgeSubstrateReceivedEvent
        return new GenericSnowbridgeInboundWithContext({
          chainId,
          blockHash: blockEvent.blockHash as HexString,
          blockNumber: blockEvent.blockNumber,
          channelId: channel_id,
          messageId: message_id,
          nonce: nonce.toString(),
          outcome: 'Success',
          event: blockEvent,
          timestamp: blockEvent.timestamp,
          txHash: blockEvent.extrinsic?.hash as HexString,
          txPosition: blockEvent.extrinsic?.blockPosition,
        })
      }),
    )
  }
}

export function extractSnowbridgeSubstrateOutbound(chainId: NetworkURN) {
  return (source: Observable<BlockEvent>): Observable<SnowbridgeMessageAccepted> => {
    return source.pipe(
      filter((event) => matchEvent(event, 'EthereumOutboundQueue', 'MessageAccepted')),
      map((blockEvent) => {
        const { id, nonce } = blockEvent.value as SnowbridgeSubstrateAcceptedEvent
        return new GenericSnowbridgeMessageAccepted({
          chainId,
          blockHash: blockEvent.blockHash as HexString,
          blockNumber: blockEvent.blockNumber,
          messageId: id,
          nonce: nonce.toString(),
          recipient: 'urn:ocn:ethereum:1',
          event: blockEvent,
          timestamp: blockEvent.timestamp,
          txHash: blockEvent.extrinsic?.hash as HexString,
          txPosition: blockEvent.extrinsic?.blockPosition,
        })
      }),
    )
  }
}
