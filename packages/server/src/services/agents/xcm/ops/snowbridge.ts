import { filter, from, map, mergeMap, Observable } from 'rxjs'
import { Abi, decodeAbiParameters, decodeEventLog, TransactionReceipt } from 'viem'
import { asSerializable } from '@/common/util.js'
import { AnyJson, HexString, NetworkURN } from '@/lib.js'
import { createNetworkId, getConsensus } from '@/services/config.js'
import { filterTransactions } from '@/services/networking/evm/rx/extract.js'
import { Block, DecodedTxWithReceipt, LogTopics } from '@/services/networking/evm/types.js'
import { findLogInTx } from '@/services/networking/evm/utils.js'
import { defaultPolkadotContext } from '@/services/networking/substrate/.static/index.js'
import { BlockEvent } from '@/services/networking/substrate/types.js'
import gatewayAbi from '../abis/gateway-mini.json' with { type: 'json' }
import {
  GenericSnowbridgeMessageAccepted,
  GenericSnowbridgeOutboundAccepted,
  GenericXcmBridge,
  GenericXcmBridgeInboundWithContext,
  Leg,
  PartialHumanizedAsset,
  SnowbridgeMessageAccepted,
  SnowbridgeOutboundAccepted,
  XcmBridge,
  XcmBridgeInboundWithContext,
  XcmJourney,
  XcmTerminusContext,
  XcmWaypointContext,
} from '../types/messages.js'
import { recursiveExtractStops, Stop } from './common.js'
import { getMessageId, matchEvent } from './util.js'
import { asVersionedXcm, messageHash } from './xcm-format.js'

const ASSET_HUB_PARAID = '1000'
const BRIDGE_HUB_PARAID = '1002'

enum XcmKind {
  Raw = 0,
  CreateAsset = 1,
}

enum AssetKind {
  NativeTokenERC20 = 0,
  ForeignTokenERC20 = 1,
}

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

type SnowbridgeEvmV2OutboundAcceptedLog = {
  eventName: string
  args: {
    nonce: bigint
    payload: {
      origin: HexString
      assets: { kind: number; data: HexString }[]
      xcm: {
        kind: number
        data: HexString
      }
      claimer: HexString
      value: bigint
      executionFee: bigint
      relayerFee: bigint
    }
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
  channel_id?: HexString
  message_id: HexString
  nonce: number
  fee_burned?: number
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
            version: 1,
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
            version: 2,
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

function handleV1SendToken(chainId: NetworkURN, tx: DecodedTxWithReceipt) {
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
    version: 1,
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
    recipient: createNetworkId('polkadot', destinationChain.toString()),
    event: { name: acceptedEventName, args: asSerializable(acceptedEventArgs) } as AnyJson,
    timestamp: tx.timestamp,
    txHash: tx.hash,
    txPosition: tx.transactionIndex ?? undefined,
    partialHumanized: {
      beneficiary,
      assets: [
        {
          chainId,
          id: token,
          amount: amount.toString(),
        },
      ],
    },
  })
}

function mapV2Assets(
  chainId: NetworkURN,
  assets: {
    kind: number
    data: HexString
  }[],
  value: bigint,
): PartialHumanizedAsset[] {
  const assetsSent: PartialHumanizedAsset[] = [
    {
      chainId,
      id: '0x0000000000000000000000000000000000000000',
      amount: value.toString(),
    },
  ]
  for (const a of assets) {
    if (a.kind === AssetKind.NativeTokenERC20) {
      const [token, amount] = decodeAbiParameters(
        [
          { type: 'address', name: 'token' },
          { type: 'uint128', name: 'amount' },
        ],
        a.data,
      )
      assetsSent.push({
        chainId,
        id: token,
        amount: amount.toString(),
      })
    } else if (a.kind === AssetKind.ForeignTokenERC20) {
      const [token, amount] = decodeAbiParameters(
        [
          { type: 'bytes32', name: 'foreignID' },
          { type: 'uint128', name: 'amount' },
        ],
        a.data,
      )
      assetsSent.push({
        chainId,
        id: token,
        amount: amount.toString(),
      })
    }
  }
  return assetsSent
}

function handleV2SendMessage(chainId: NetworkURN, tx: DecodedTxWithReceipt) {
  const acceptedLog = findLogInTx(tx, gatewayAbi as Abi, 'OutboundMessageAccepted')
  if (!acceptedLog || tx.blockHash === null || tx.blockNumber === null) {
    return null
  }
  const { eventName: acceptedEventName, args: acceptedEventArgs } = decodeEventLog({
    abi: gatewayAbi as Abi,
    topics: acceptedLog.topics as LogTopics,
    data: acceptedLog.data,
  }) as unknown as SnowbridgeEvmV2OutboundAcceptedLog
  const {
    nonce,
    payload: { origin, assets, xcm, claimer, value },
  } = acceptedEventArgs

  if (xcm.kind === XcmKind.Raw) {
    const program = asVersionedXcm(xcm.data, defaultPolkadotContext)

    return new GenericSnowbridgeOutboundAccepted({
      version: 2,
      chainId,
      blockHash: tx.blockHash,
      blockNumber: tx.blockNumber.toString(),
      messageId: getMessageId(program)!,
      nonce: nonce.toString(),
      messageData: xcm.data,
      messageHash: program.hash,
      sender: {
        signer: {
          id: origin,
          publicKey: origin,
        },
        extraSigners: [],
      },
      claimer,
      recipient: createNetworkId('polkadot', ASSET_HUB_PARAID),
      event: { name: acceptedEventName, args: asSerializable(acceptedEventArgs) } as AnyJson,
      timestamp: tx.timestamp,
      txHash: tx.hash,
      txPosition: tx.transactionIndex ?? undefined,
      partialHumanized: {
        assets: mapV2Assets(chainId, assets, value),
      },
      instructions: {
        bytes: program.data,
        json: program.instructions,
      },
    })
  } else if (xcm.kind === XcmKind.CreateAsset) {
    return new GenericSnowbridgeOutboundAccepted({
      version: 2,
      chainId,
      blockHash: tx.blockHash,
      blockNumber: tx.blockNumber.toString(),
      nonce: nonce.toString(),
      messageData: xcm.data,
      messageHash: messageHash(xcm.data),
      sender: {
        signer: {
          id: origin,
          publicKey: origin,
        },
        extraSigners: [],
      },
      claimer,
      recipient: createNetworkId('polkadot', ASSET_HUB_PARAID),
      event: { name: acceptedEventName, args: asSerializable(acceptedEventArgs) } as AnyJson,
      timestamp: tx.timestamp,
      txHash: tx.hash,
      txPosition: tx.transactionIndex ?? undefined,
      partialHumanized: {
        assets: mapV2Assets(chainId, assets, value),
      },
    })
  }
  console.warn(`Snowbridge V2 xcm kind ${xcm.kind} not supported (tx=${tx.hash})`)
  return null
}

export function extractSnowbridgeEvmOutbound(
  chainId: NetworkURN,
  contractAddress: HexString,
  getTransactionReceipt: (txHash: HexString) => Promise<TransactionReceipt>,
) {
  return (source: Observable<Block>): Observable<SnowbridgeOutboundAccepted> => {
    return source.pipe(
      filterTransactions({ abi: gatewayAbi as Abi, addresses: [contractAddress] }, [
        'sendToken',
        'v2_sendMessage',
      ]),
      mergeMap((tx) =>
        from(getTransactionReceipt(tx.hash)).pipe(
          map((receipt) => ({ ...tx, receipt }) as DecodedTxWithReceipt),
        ),
      ),
      map((tx) => {
        if (!tx.decoded || tx.receipt.status === 'reverted') {
          return null
        }
        if (tx.decoded.functionName === 'sendToken') {
          return handleV1SendToken(chainId, tx)
        }
        if (tx.decoded.functionName === 'v2_sendMessage') {
          return handleV2SendMessage(chainId, tx)
        }
        return null
      }),
      filter((msg) => msg !== null),
    )
  }
}

export function extractSnowbridgeSubstrateInbound(chainId: NetworkURN) {
  return (source: Observable<BlockEvent>): Observable<XcmBridgeInboundWithContext> => {
    return source.pipe(
      filter((event) =>
        matchEvent(event, ['EthereumInboundQueue', 'EthereumInboundQueueV2'], 'MessageReceived'),
      ),
      map((blockEvent) => {
        const { channel_id, message_id, nonce } = blockEvent.value as SnowbridgeSubstrateReceivedEvent
        return new GenericXcmBridgeInboundWithContext({
          version: blockEvent.module === 'EthereumInboundQueueV2' ? 2 : 1,
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
          version: blockEvent.module === 'EthereumOutboundQueueV2' ? 2 : 1,
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

function toSnowbridgeV2Legs(origin: NetworkURN, recipient: NetworkURN, instructions: any[]) {
  const stops: Stop[] = [{ networkId: recipient }]
  recursiveExtractStops(origin, instructions, stops)

  const bridgeHub = createNetworkId(recipient, BRIDGE_HUB_PARAID)
  const relay = createNetworkId(recipient, '0')
  const legs: Leg[] = [
    {
      from: origin,
      to: bridgeHub,
      type: 'bridge',
    },
  ]

  for (const [index, stop] of stops.entries()) {
    const prev = legs[index]
    legs.push({
      from: prev.to,
      to: stop.networkId,
      relay,
      type: index === stops.length - 1 ? 'hrmp' : 'hop',
    })
  }

  return legs
}

export function mapOutboundToXcmBridge() {
  return (source: Observable<SnowbridgeOutboundAccepted>): Observable<XcmBridge> => {
    return source.pipe(
      map(
        ({
          version,
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
          partialHumanized,
          instructions,
        }) => {
          const legs =
            version === 2 && instructions
              ? toSnowbridgeV2Legs(chainId, recipient, instructions.json.value as any[])
              : toSnowbridgeLegs(chainId, recipient)
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
            instructions: instructions?.json,
          }
          const waypoint: XcmWaypointContext = {
            ...origin,
            legIndex: 0,
          }
          const originMsg: XcmJourney = {
            type: 'xcm.sent',
            origin,
            destination: {
              chainId: legs[legs.length - 1].to,
            },
            originProtocol: 'snowbridge',
            destinationProtocol: 'xcm',
            legs,
            waypoint,
            messageId,
            sender,
            partialHumanized,
          }
          return new GenericXcmBridge(originMsg, waypoint, {
            bridgeStatus: 'accepted',
            channelId,
            nonce,
            bridgeName: 'snowbridge',
            version,
          })
        },
      ),
    )
  }
}
