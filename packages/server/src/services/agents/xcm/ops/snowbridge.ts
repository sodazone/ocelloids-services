import { filter, from, map, mergeMap, Observable } from 'rxjs'
import { Abi, decodeEventLog, TransactionReceipt } from 'viem'
import { asSerializable, hexTimestampToMillis } from '@/common/util.js'
import { AnyJson, HexString, NetworkURN } from '@/lib.js'
import { createNetworkId, getConsensus } from '@/services/config.js'
import { filterTransactions } from '@/services/networking/evm/rx/extract.js'
import { Block, DecodedTxWithReceipt, LogTopics } from '@/services/networking/evm/types.js'
import { findLogInTx } from '@/services/networking/evm/utils.js'
import { BlockEvent } from '@/services/networking/substrate/types.js'
import gatewayAbi from '../abis/gateway-mini.json' with { type: 'json' }
import {
  GenericSnowbridgeMessageAccepted,
  GenericSnowbridgeOutboundAccepted,
  GenericXcmBridge,
  GenericXcmBridgeInboundWithContext,
  Leg,
  SnowbridgeMessageAccepted,
  SnowbridgeOutboundAccepted,
  XcmBridge,
  XcmBridgeInboundWithContext,
  XcmJourney,
  XcmTerminusContext,
  XcmWaypointContext,
} from '../types/messages.js'
import { matchEvent } from './util.js'
import { messageHash } from './xcm-format.js'

const ASSET_HUB_PARAID = '1000'
const BRIDGE_HUB_PARAID = '1002'

type SnowbridgeEvmInboundLog = {
  eventName: string
  args: { channelID: HexString; messageID: HexString; nonce: string; success: boolean }
}

type SnowbridgeEvmInboundV2Log = {
  eventName: string
  args: { topic: HexString; nonce: string; success: boolean; rewardAddress: HexString }
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

export function extractSnowbridgeEvmInbound(
  chainId: NetworkURN,
  contractAddress: HexString,
  getTransactionReceipt: (txHash: HexString) => Promise<TransactionReceipt>,
) {
  return (source: Observable<Block>): Observable<XcmBridgeInboundWithContext> => {
    return source.pipe(
      filterTransactions({ abi: gatewayAbi as Abi, addresses: [contractAddress] }, ['submitV1', 'v2_submit']),
      mergeMap((tx) =>
        from(getTransactionReceipt(tx.hash)).pipe(
          map((receipt) => ({ ...tx, receipt }) as DecodedTxWithReceipt),
        ),
      ),
      map((tx) => {
        const inboundLog = findLogInTx(tx, gatewayAbi as Abi, 'InboundMessageDispatched')

        if (!inboundLog || tx.blockHash === null || tx.blockNumber === null) {
          return null
        }

        if (tx.decoded?.functionName === 'submitV1') {
          const { eventName: inboundEventName, args: inboundEventArgs } = decodeEventLog({
            abi: gatewayAbi as Abi,
            topics: inboundLog.topics as LogTopics,
            data: inboundLog.data,
          }) as unknown as SnowbridgeEvmInboundLog
          const { channelID, messageID, nonce, success } = inboundEventArgs

          return new GenericXcmBridgeInboundWithContext({
            chainId,
            blockHash: tx.blockHash,
            blockNumber: tx.blockNumber.toString(),
            channelId: channelID,
            messageId: messageID,
            nonce: nonce.toString(),
            outcome: success ? 'Success' : 'Fail',
            event: { name: inboundEventName, args: asSerializable(inboundEventArgs) } as AnyJson,
            timestamp: tx.timestamp,
            txHash: tx.hash,
            txPosition: tx.transactionIndex ?? undefined,
          })
        }
        if (tx.decoded?.functionName === 'v2_submit') {
          const { eventName: inboundEventName, args: inboundEventArgs } = decodeEventLog({
            abi: gatewayAbi as Abi,
            topics: inboundLog.topics as LogTopics,
            data: inboundLog.data,
          }) as unknown as SnowbridgeEvmInboundV2Log
          const { nonce, success, topic } = inboundEventArgs

          return new GenericXcmBridgeInboundWithContext({
            chainId,
            blockHash: tx.blockHash,
            blockNumber: tx.blockNumber.toString(),
            messageId: topic,
            nonce: nonce.toString(),
            outcome: success ? 'Success' : 'Fail',
            event: { name: inboundEventName, args: asSerializable(inboundEventArgs) } as AnyJson,
            timestamp: tx.timestamp,
            txHash: tx.hash,
            txPosition: tx.transactionIndex ?? undefined,
          })
        }
        return null
      }),
      filter((msg) => msg !== null),
    )
  }
}

export function extractSnowbridgeEvmOutbound(
  chainId: NetworkURN,
  contractAddress: HexString,
  getTransactionReceipt: (txHash: HexString) => Promise<TransactionReceipt>,
) {
  return (source: Observable<Block>): Observable<SnowbridgeOutboundAccepted> => {
    return source.pipe(
      filterTransactions({ abi: gatewayAbi as Abi, addresses: [contractAddress] }, ['sendToken']),
      mergeMap((tx) =>
        from(getTransactionReceipt(tx.hash)).pipe(
          map((receipt) => ({ ...tx, receipt }) as DecodedTxWithReceipt),
        ),
      ),
      map((tx) => {
        if (tx.receipt.status === 'reverted') {
          return null
        }
        const tokenSentLog = findLogInTx(tx, gatewayAbi as Abi, 'TokenSent')
        const acceptedLog = findLogInTx(tx, gatewayAbi as Abi, 'OutboundMessageAccepted')
        if (!acceptedLog || !tokenSentLog || tx.blockHash === null || tx.blockNumber === null) {
          return null
        }

        const { eventName: acceptedEventName, args: acceptedEventArgs } = decodeEventLog({
          abi: gatewayAbi as Abi,
          topics: acceptedLog.topics as LogTopics,
          data: acceptedLog.data,
        }) as unknown as SnowbridgeEvmOutboundAcceptedLog
        const { channelID, messageID, nonce, payload } = acceptedEventArgs
        const {
          args: { amount, destinationAddress, destinationChain, sender, token },
        } = decodeEventLog({
          abi: gatewayAbi as Abi,
          topics: tokenSentLog.topics as LogTopics,
          data: tokenSentLog.data,
        }) as unknown as SnowbridgeEvmTokenSentLog

        const beneficiary =
          destinationAddress.kind === 2
            ? (destinationAddress.data.slice(0, 42) as HexString)
            : destinationAddress.data
        return new GenericSnowbridgeOutboundAccepted({
          chainId,
          blockHash: tx.blockHash,
          blockNumber: tx.blockNumber.toString(),
          channelId: channelID,
          messageId: messageID,
          nonce: nonce.toString(),
          messageData: payload,
          messageHash: messageHash(payload),
          sender: {
            signer: {
              id: sender,
              publicKey: sender,
            },
            extraSigners: [],
          },
          beneficiary,
          recipient: createNetworkId('polkadot', destinationChain.toString()),
          asset: {
            chainId,
            id: token,
            amount: amount.toString(),
          },
          event: { name: acceptedEventName, args: asSerializable(acceptedEventArgs) } as AnyJson,
          timestamp: hexTimestampToMillis((acceptedLog as any)['blockTimestamp']),
          txHash: tx.hash,
          txPosition: tx.transactionIndex ?? undefined,
        })
      }),
      filter((msg) => msg !== null),
    )
  }
}

export function extractSnowbridgeSubstrateInbound(chainId: NetworkURN) {
  return (source: Observable<BlockEvent>): Observable<XcmBridgeInboundWithContext> => {
    return source.pipe(
      filter((event) => matchEvent(event, 'EthereumInboundQueue', 'MessageReceived')),
      map((blockEvent) => {
        const { channel_id, message_id, nonce } = blockEvent.value as SnowbridgeSubstrateReceivedEvent
        return new GenericXcmBridgeInboundWithContext({
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
      filter((event) =>
        matchEvent(event, ['EthereumOutboundQueue', 'EthereumOutboundQueueV2'], 'MessageAccepted'),
      ),
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

function toSnowbridgeLegs(origin: NetworkURN, destination: NetworkURN): Leg[] {
  const originConsensus = getConsensus(origin)
  if (originConsensus !== 'ethereum') {
    throw new Error(`Origin consensus ${originConsensus} for snowbridge outbound not supported.`)
  }
  const destinationConsensus = getConsensus(destination)
  if (originConsensus === destinationConsensus) {
    throw new Error('Origin consensus and destination consensus for snowbridge outbound cannot be the same.')
  }
  const bridgeHub = createNetworkId(destination, BRIDGE_HUB_PARAID)
  const assetHub = createNetworkId(destination, ASSET_HUB_PARAID)
  const relay = createNetworkId(destination, '0')
  const legs: Leg[] = [
    {
      from: origin,
      to: bridgeHub,
      type: 'bridge',
    },
    {
      from: bridgeHub,
      to: assetHub,
      relay,
      type: 'hrmp',
    },
  ]
  if (destination !== assetHub) {
    legs[1].type = 'hop'
    legs.push({
      from: assetHub,
      to: destination,
      relay,
      type: 'hrmp',
    })
  }
  return legs
}

export function mapOutboundToXcmBridge() {
  return (source: Observable<SnowbridgeOutboundAccepted>): Observable<XcmBridge> => {
    return source.pipe(
      map(
        ({
          chainId,
          messageId,
          channelId,
          nonce,
          blockHash,
          blockNumber,
          event,
          txHash,
          txPosition,
          timestamp,
          messageData,
          messageHash,
          recipient,
          sender,
          asset,
          beneficiary,
        }) => {
          const origin: XcmTerminusContext = {
            chainId,
            blockHash,
            timestamp,
            blockNumber: blockNumber.toString(),
            event,
            txHash,
            txPosition,
            messageData,
            messageHash,
            outcome: 'Success', // always 'Success' since it's accepted
            error: null,
            instructions: null,
          }
          const waypoint: XcmWaypointContext = {
            ...origin,
            legIndex: 0,
          }
          const originMsg: XcmJourney = {
            type: 'xcm.sent',
            origin,
            destination: {
              chainId: recipient,
            },
            originProtocol: 'snowbridge',
            destinationProtocol: 'xcm',
            legs: toSnowbridgeLegs(chainId, recipient),
            waypoint,
            messageId,
            sender,
            partialHumanized: {
              asset,
              beneficiary,
            },
          }
          return new GenericXcmBridge(originMsg, waypoint, {
            bridgeStatus: 'accepted',
            channelId,
            nonce,
            bridgeName: 'snowbridge',
          })
        },
      ),
    )
  }
}
