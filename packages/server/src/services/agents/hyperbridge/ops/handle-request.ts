import { filter, from, mergeMap, Observable, switchMap } from 'rxjs'
import { Abi, hexToString, TransactionReceipt } from 'viem'
import { asSerializable } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { filterTransactions } from '@/services/networking/evm/rx/extract.js'
import { BlockWithLogs } from '@/services/networking/evm/types.js'
import { BlockExtrinsicWithEvents, Call, SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { NetworkURN } from '@/services/types.js'
import { matchExtrinsic } from '../../xcm/ops/util.js'
import handlerV1Abi from '../abis/handler-v1.json' with { type: 'json' }
import { getHandlerContractAddress } from '../config.js'
import {
  EvmHandlePostRequestArgs,
  EvmHandlePostRequestBody,
  EvmHandlePostRequestTimeoutArgs,
  HyperbridgeContext,
  IsmpPostRequestHandledWithContext,
  SubstrateHandlePostRequestBody,
  SubstrateHandleUnsignedArgs,
  SubstrateHandleUnsignedRequestObject,
  SubstrateHandleUnsignedTimeoutObject,
  SubstratePostRequestTimeout,
} from '../types.js'
import { decompress, extractSigner, toCommitmentHash, toFormattedNetwork, toTimeoutMillis } from './common.js'

function buildHandledPostRequest(
  req: SubstrateHandlePostRequestBody | EvmHandlePostRequestBody,
  ctx: HyperbridgeContext & { chainId: NetworkURN; outcome: 'Success' | 'Fail' },
  extra: { type: 'Received' | 'Timeout'; relayer?: HexString },
): IsmpPostRequestHandledWithContext {
  const timeout = 'timeout_timestamp' in req ? req.timeout_timestamp : req.timeoutTimestamp
  const source = typeof req.source === 'string' ? hexToString(req.source) : req.source
  const dest = typeof req.dest === 'string' ? hexToString(req.dest) : req.dest
  return {
    ...ctx,
    source: toFormattedNetwork(source),
    destination: toFormattedNetwork(dest),
    commitment: toCommitmentHash({
      ...req,
      timeoutTimestamp: timeout,
      source,
      dest,
    }),
    nonce: req.nonce,
    from: req.from,
    to: req.to,
    body: req.body,
    timeoutAt: toTimeoutMillis(timeout),
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
        relayer: extractSigner(signer),
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

function mapHandleUnsigned(chainId: NetworkURN) {
  return (tx: BlockExtrinsicWithEvents): IsmpPostRequestHandledWithContext[] => {
    const args = tx.args as SubstrateHandleUnsignedArgs
    if (!args.messages) {
      return []
    }

    try {
      const { blockHash, blockNumber, timestamp, hash, evmTxHash, blockPosition, dispatchError } = tx
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
        txPosition: blockPosition,
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
    } catch (err) {
      console.error(err, `[${chainId}] Error mapping handle_unsigned at #${tx.blockNumber} (${tx.blockHash})`)
      return []
    }
  }
}

export function extractSubstrateHandleUnsigned(chainId: NetworkURN) {
  return (source: Observable<BlockExtrinsicWithEvents>): Observable<IsmpPostRequestHandledWithContext> => {
    return source.pipe(
      filter((tx) => matchExtrinsic(tx, 'Ismp', 'handle_unsigned')),
      mergeMap(mapHandleUnsigned(chainId)),
    )
  }
}

async function toDecompressedCall(
  tx: BlockExtrinsicWithEvents,
  ctx: SubstrateApiContext,
): Promise<BlockExtrinsicWithEvents> {
  try {
    const { compressed, encoded_call_size } = tx.args as { compressed: HexString; encoded_call_size: number }
    const dec = await decompress(compressed, Number(encoded_call_size))
    const call = asSerializable(ctx.decodeCall(dec)) as Call
    return {
      ...tx,
      ...call,
    }
  } catch (err) {
    console.warn(err, `Unable to decompress call ${tx.blockNumber}-${tx.blockPosition}`)
    return tx
  }
}

export function extractSubstrateHandleRequestFromCompressedCall(
  chainId: NetworkURN,
  ctx: SubstrateApiContext,
) {
  return (source: Observable<BlockExtrinsicWithEvents>): Observable<IsmpPostRequestHandledWithContext> => {
    return source.pipe(
      filter((tx) => matchExtrinsic(tx, 'CallDecompressor', 'decompress_call')),
      mergeMap((tx) =>
        from(toDecompressedCall(tx, ctx)).pipe(
          filter((tx) => matchExtrinsic(tx, 'Ismp', 'handle_unsigned')),
          mergeMap(mapHandleUnsigned(chainId)),
        ),
      ),
    )
  }
}

export function extractEvmHandlePostRequest(
  chainId: NetworkURN,
  getTransactionReceipt: (txHash: HexString) => Promise<TransactionReceipt>,
) {
  return (source: Observable<BlockWithLogs>): Observable<IsmpPostRequestHandledWithContext> => {
    return source.pipe(
      filterTransactions(
        {
          abi: handlerV1Abi as Abi,
          addresses: [getHandlerContractAddress(chainId)].filter((a) => a !== null),
        },
        ['handlePostRequests', 'handlePostRequestTimeouts'],
      ),
      mergeMap((tx) =>
        from(getTransactionReceipt(tx.hash)).pipe(
          mergeMap(({ status }) => {
            const { blockHash, blockNumber, hash, transactionIndex, timestamp, from } = tx
            if (!tx.decoded || blockHash === null || blockNumber === null) {
              return []
            }
            try {
              const ctx: HyperbridgeContext & {
                chainId: NetworkURN
                outcome: 'Success' | 'Fail'
              } = {
                chainId,
                blockHash: blockHash as HexString,
                blockNumber: blockNumber.toString(),
                timestamp,
                txHash: hash as HexString,
                txPosition: transactionIndex ?? undefined,
                outcome: status === 'success' ? 'Success' : 'Fail',
              }

              if (tx.decoded.functionName === 'handlePostRequests') {
                const [_host, { requests }] = tx.decoded.args as EvmHandlePostRequestArgs
                return requests.map(({ request }) => {
                  return buildHandledPostRequest(request, ctx, {
                    relayer: from,
                    type: 'Received',
                  })
                })
              }

              if (tx.decoded.functionName === 'handlePostRequestTimeouts') {
                const [_host, { timeouts }] = tx.decoded.args as EvmHandlePostRequestTimeoutArgs
                return timeouts.map((req) =>
                  buildHandledPostRequest(req, ctx, {
                    type: 'Timeout',
                  }),
                )
              }

              throw new Error('Unknown handle request type')
            } catch (err) {
              console.error(
                err,
                `[${chainId}] Error extracting handle POST request at #${tx.blockNumber} (${tx.blockHash})`,
              )
              return []
            }
          }),
        ),
      ),
    )
  }
}
