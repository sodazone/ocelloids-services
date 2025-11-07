import { filter, map, mergeMap, Observable, switchMap } from 'rxjs'
import { Abi } from 'viem'
import { hexTimestampToMillis } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { filterLogs } from '@/services/networking/evm/rx/extract.js'
import { BlockWithLogs } from '@/services/networking/evm/types.js'
import { BlockEvent, BlockExtrinsicWithEvents } from '@/services/networking/substrate/types.js'
import { NetworkURN } from '@/services/types.js'
import { matchEvent, matchExtrinsic } from '../../xcm/ops/util.js'
import hostAbi from '../abis/evm-host.json' with { type: 'json' }
import { getHostContractAddress } from '../config.js'
import {
  EvmPostRequestEvent,
  HyperbridgeContext,
  IsmpPostRequestHandledWithContext,
  IsmpPostRequestWithContext,
  SubstrateHandleUnsignedArgs,
  SubstrateHandleUnsignedRequest,
  SubstrateHandleUnsignedRequestObject,
  SubstrateHandleUnsignedTimeoutObject,
  SubstrateOffchainRequest,
  SubstratePostRequestEvent,
  SubstratePostRequestTimeout,
} from '../types.js'
import { toCommitmentHash, toFormattedNetwork } from './common.js'

export function extractSubstrateRequest(
  chainId: NetworkURN,
  getIsmpRequest: (commitment: HexString) => Observable<SubstrateOffchainRequest>,
) {
  return (source: Observable<BlockEvent>): Observable<IsmpPostRequestWithContext> => {
    return source.pipe(
      filter((event) => matchEvent(event, 'Ismp', 'Request')),
      switchMap(({ value, blockHash, blockNumber, timestamp, extrinsic }) => {
        const { source_chain, dest_chain, request_nonce, commitment } = value as SubstratePostRequestEvent
        return getIsmpRequest(commitment).pipe(
          map(({ from, to, timeoutTimestamp, body }) => {
            return {
              chainId,
              blockHash: blockHash as HexString,
              blockNumber: blockNumber.toString(),
              timestamp,
              txHash: extrinsic?.hash ? (extrinsic.hash as HexString) : undefined,
              txHashSecondary: extrinsic?.evmTxHash ? (extrinsic.evmTxHash as HexString) : undefined,
              source: toFormattedNetwork(source_chain),
              destination: toFormattedNetwork(dest_chain),
              commitment,
              nonce: request_nonce.toString(),
              from,
              to,
              timeout: timeoutTimestamp.toString(),
              body,
              outcome: 'Success',
            } as IsmpPostRequestWithContext
          }),
        )
      }),
    )
  }
}

function buildHandledPostRequest(
  req: SubstrateHandleUnsignedRequest,
  ctx: HyperbridgeContext & { chainId: NetworkURN; outcome: 'Success' | 'Fail' },
  extra: { type: 'Received' | 'Timeout'; relayer?: HexString },
): IsmpPostRequestHandledWithContext {
  const { source, dest, timeout_timestamp, ...rest } = req

  return {
    ...ctx,
    source: toFormattedNetwork(source),
    destination: toFormattedNetwork(dest),
    commitment: toCommitmentHash({
      ...req,
      source: `${source.type.toUpperCase()}-${source.value.toString()}`,
      dest: `${dest.type.toUpperCase()}-${dest.value.toString()}`,
      timeoutTimestamp: timeout_timestamp,
    }),
    timeout: timeout_timestamp,
    ...rest,
    ...extra,
  }
}

function extractReceivedRequests(
  requests: {
    type: 'Request'
    value: SubstrateHandleUnsignedRequestObject
  }[],
  ctx: HyperbridgeContext & { chainId: NetworkURN; outcome: 'Success' | 'Fail' },
): IsmpPostRequestHandledWithContext[] {
  return requests.flatMap(({ value: { requests, signer } }) =>
    requests.map((req) =>
      buildHandledPostRequest(req, ctx, {
        relayer: signer,
        type: 'Received',
      }),
    ),
  )
}

function extractTimeoutRequests(
  timeouts: SubstratePostRequestTimeout[],
  ctx: HyperbridgeContext & { chainId: NetworkURN; outcome: 'Success' | 'Fail' },
): IsmpPostRequestHandledWithContext[] {
  return timeouts.flatMap(({ value: { requests } }) =>
    requests
      .filter((r) => r.type === 'Post')
      .map((r) =>
        buildHandledPostRequest(r.value, ctx, {
          type: 'Timeout',
        }),
      ),
  )
}

export function extractSubstrateHandleUnsigned(chainId: NetworkURN) {
  return (source: Observable<BlockExtrinsicWithEvents>): Observable<IsmpPostRequestHandledWithContext> => {
    return source.pipe(
      filter((tx) => matchExtrinsic(tx, 'Ismp', 'handle_unsigned')),
      mergeMap((tx) => {
        const args = tx.args as SubstrateHandleUnsignedArgs
        if (!args.messages) {
          return []
        }

        const { blockHash, blockNumber, timestamp, hash, evmTxHash, dispatchError } = tx
        const ctx: HyperbridgeContext & {
          chainId: NetworkURN
          outcome: 'Success' | 'Fail'
        } = {
          chainId,
          blockHash: blockHash as HexString,
          blockNumber: blockNumber.toString(),
          timestamp,
          txHash: hash as HexString | undefined,
          txHashSecondary: evmTxHash as HexString | undefined,
          outcome: dispatchError ? 'Fail' : 'Success',
        }

        // Extract Received
        const received = extractReceivedRequests(
          args.messages
            .filter(
              (m): m is { type: 'Request'; value: SubstrateHandleUnsignedRequestObject } =>
                m.type === 'Request',
            )
            .map((m) => m),
          ctx,
        )

        // Extract Timeout → only POST timeouts
        const timeouts = extractTimeoutRequests(
          args.messages
            .filter(
              (m): m is { type: 'Timeout'; value: SubstrateHandleUnsignedTimeoutObject } =>
                m.type === 'Timeout' && m.value.type === 'Post',
            )
            .map((m) => m.value as SubstratePostRequestTimeout),
          ctx,
        )

        return [...received, ...timeouts]
      }),
    )
  }
}

export function extractEvmRequest(chainId: NetworkURN) {
  return (source: Observable<BlockWithLogs>): Observable<IsmpPostRequestWithContext> => {
    return source.pipe(
      filterLogs(
        {
          abi: hostAbi as Abi,
          addresses: [getHostContractAddress(chainId)],
        },
        ['PostRequestEvent'],
      ),
      map((decodedLog) => {
        const { decoded, blockHash, blockNumber, transactionHash, transactionIndex } = decodedLog
        if (decoded && decoded.args && blockHash && blockNumber) {
          const eventArgs = decoded.args as EvmPostRequestEvent
          const { source, dest, from, to, nonce, timeoutTimestamp, body } = eventArgs
          return {
            chainId,
            blockHash: blockHash,
            blockNumber: blockNumber.toString(),
            timestamp: hexTimestampToMillis((decodedLog as any)['blockTimestamp']),
            txHash: transactionHash ?? undefined,
            txPosition: transactionIndex ?? undefined,
            source: toFormattedNetwork(source),
            destination: toFormattedNetwork(dest),
            commitment: toCommitmentHash(eventArgs),
            nonce: nonce.toString(),
            from,
            to,
            timeout: timeoutTimestamp.toString(),
            body,
            outcome: 'Success',
          } as IsmpPostRequestWithContext
        }

        return null
      }),
      filter((msg) => msg !== null),
    )
  }
}
