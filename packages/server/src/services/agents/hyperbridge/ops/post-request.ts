import { filter, map, mergeMap, Observable } from 'rxjs'
import { hexTimestampToMillis } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { DecodedLog } from '@/services/networking/evm/types.js'
import { BlockEvent } from '@/services/networking/substrate/types.js'
import { NetworkURN } from '@/services/types.js'
import { matchEvent } from '../../xcm/ops/util.js'
import {
  EvmPostRequestEvent,
  IsmpPostRequestWithContext,
  SubstrateOffchainRequest,
  SubstratePostRequestEvent,
} from '../types.js'
import { toCommitmentHash, toFormattedNetwork, toTimeoutMillis } from './common.js'

export function extractSubstrateRequest(
  chainId: NetworkURN,
  getIsmpRequest: (commitment: HexString) => Observable<SubstrateOffchainRequest>,
) {
  return (source: Observable<BlockEvent>): Observable<IsmpPostRequestWithContext> => {
    return source.pipe(
      filter((event) => matchEvent(event, 'Ismp', 'Request')),
      mergeMap((event) => {
        const { value, blockHash, blockNumber, timestamp, extrinsic } = event
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
              timeoutAt: toTimeoutMillis(timeoutTimestamp),
              body,
              outcome: 'Success',
              event,
            } as IsmpPostRequestWithContext
          }),
        )
      }),
    )
  }
}

export function extractEvmRequest(chainId: NetworkURN) {
  return (source: Observable<DecodedLog>): Observable<IsmpPostRequestWithContext> => {
    return source.pipe(
      map((decodedLog) => {
        const { eventName, args, blockHash, blockNumber, transactionHash, transactionIndex } = decodedLog
        if (args && blockHash && blockNumber) {
          const eventArgs = args as EvmPostRequestEvent
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
            timeoutAt: toTimeoutMillis(timeoutTimestamp),
            body,
            outcome: 'Success',
            event: {
              module: 'EvmHost',
              name: eventName,
              args: args,
            },
          } as IsmpPostRequestWithContext
        }

        return null
      }),
      filter((msg) => msg !== null),
    )
  }
}
