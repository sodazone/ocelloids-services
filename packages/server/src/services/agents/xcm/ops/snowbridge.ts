import { filter, map, Observable } from 'rxjs'
import { Abi } from 'viem'
import { AnyJson, HexString, NetworkURN } from '@/lib.js'
import { createNetworkId, getConsensus } from '@/services/config.js'
import { filterTransactionsWithLogs } from '@/services/networking/evm/rx/extract.js'
import { BlockWithLogs } from '@/services/networking/evm/types.js'
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
  return (source: Observable<BlockWithLogs>): Observable<XcmBridgeInboundWithContext> => {
    return source.pipe(
      filterTransactionsWithLogs({ abi: gatewayAbi as Abi, addresses: [contractAddress] }, ['submitV1']),
      map((tx) => {
        const inboundLog = tx.logs.find(
          (l) => l.decoded && l.decoded.eventName === 'InboundMessageDispatched',
        )
        if (!inboundLog || tx.blockHash === null || tx.blockNumber === null) {
          return null
        }

        const {
          args: { channelID, messageID, nonce, success },
        } = inboundLog.decoded as SnowbridgeEvmInboundLog

        return new GenericXcmBridgeInboundWithContext({
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
      filter((msg) => msg !== null),
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
        if (!acceptedLog || !tokenSentLog || tx.blockHash === null || tx.blockNumber === null) {
          return null
        }

        const {
          args: { channelID, messageID, nonce, payload },
        } = acceptedLog.decoded as SnowbridgeEvmOutboundAcceptedLog
        const {
          args: { amount, destinationAddress, destinationChain, sender, token },
        } = tokenSentLog.decoded as SnowbridgeEvmTokenSentLog

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
          event: { name: acceptedLog.decoded?.eventName, args: acceptedLog.decoded?.args } as AnyJson,
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
