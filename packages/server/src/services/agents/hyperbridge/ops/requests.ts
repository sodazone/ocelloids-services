import { filter, map, Observable, switchMap } from 'rxjs'
import { Abi } from 'viem'
import { hexTimestampToMillis } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { filterLogs } from '@/services/networking/evm/rx/extract.js'
import { BlockWithLogs } from '@/services/networking/evm/types.js'
import { BlockEvent } from '@/services/networking/substrate/types.js'
import { NetworkURN } from '@/services/types.js'
import { matchEvent } from '../../xcm/ops/util.js'
import hostAbi from '../abis/evm-host.json' with { type: 'json' }
import { getHostContractAddress } from '../config.js'
import {
  EvmPostRequestEvent,
  HyperbridgePostRequestWithContext,
  SubstrateOffchainRequest,
  SubstratePostRequestEvent,
} from '../types.js'
import {
  formatNetworkFromEvmEventArg,
  formatNetworkFromSubstrateEventArg,
  toCommitmentHash,
} from './common.js'

export function extractSubstrateRequest(
  getIsmpRequest: (commitment: HexString) => Observable<SubstrateOffchainRequest>,
) {
  return (source: Observable<BlockEvent>): Observable<HyperbridgePostRequestWithContext> => {
    return source.pipe(
      filter((event) => matchEvent(event, 'Ismp', 'Request')),
      switchMap(({ value, blockHash, blockNumber, timestamp, extrinsic }) => {
        const { source_chain, dest_chain, request_nonce, commitment } = value as SubstratePostRequestEvent
        return getIsmpRequest(commitment).pipe(
          map(({ from, to, timeoutTimestamp, body }) => {
            return {
              blockHash: blockHash as HexString,
              blockNumber: blockNumber.toString(),
              timestamp,
              txHash: extrinsic?.hash ? (extrinsic.hash as HexString) : undefined,
              txHashSecondary: extrinsic?.evmTxHash ? (extrinsic.evmTxHash as HexString) : undefined,
              source: formatNetworkFromSubstrateEventArg(source_chain),
              destination: formatNetworkFromSubstrateEventArg(dest_chain),
              commitment,
              nonce: request_nonce.toString(),
              from,
              to,
              timeout: timeoutTimestamp,
              body,
            }
          }),
        )
      }),
    )
  }
}

export function extractEvmRequest(chainId: NetworkURN) {
  return (source: Observable<BlockWithLogs>): Observable<HyperbridgePostRequestWithContext> => {
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
            blockHash: blockHash,
            blockNumber: blockNumber.toString(),
            timestamp: hexTimestampToMillis((decodedLog as any)['blockTimestamp']),
            txHash: transactionHash ?? undefined,
            txPosition: transactionIndex ?? undefined,
            source: formatNetworkFromEvmEventArg(source),
            destination: formatNetworkFromEvmEventArg(dest),
            commitment: toCommitmentHash(eventArgs),
            nonce: nonce.toString(),
            from,
            to,
            timeout: Number(timeoutTimestamp),
            body,
          }
        }

        return null
      }),
      filter((msg) => msg !== null),
    )
  }
}
