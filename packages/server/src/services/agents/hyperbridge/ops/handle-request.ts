import { filter, from, mergeMap, Observable, switchMap, tap } from 'rxjs'
import { asSerializable } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { BlockExtrinsicWithEvents, Call, SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { NetworkURN } from '@/services/types.js'
import { matchExtrinsic } from '../../xcm/ops/util.js'
import {
  HyperbridgeContext,
  IsmpPostRequestHandledWithContext,
  SubstrateHandleUnsignedArgs,
  SubstrateHandleUnsignedRequest,
  SubstrateHandleUnsignedRequestObject,
  SubstrateHandleUnsignedTimeoutObject,
  SubstratePostRequestTimeout,
} from '../types.js'
import { extractSigner, toCommitmentHash, toFormattedNetwork, decompress } from './common.js'

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
          (m): m is { type: 'Request'; value: SubstrateHandleUnsignedRequestObject } => m.type === 'Request',
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
