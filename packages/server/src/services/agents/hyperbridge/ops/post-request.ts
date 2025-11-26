import { filter, from, map, mergeMap, Observable } from 'rxjs'
import { Abi, decodeEventLog, TransactionReceipt } from 'viem'
import { asSerializable } from '@/common/util.js'
import { HexString } from '@/lib.js'
import { filterTransactions } from '@/services/networking/evm/rx/extract.js'
import { Block, DecodedTxWithReceipt, LogTopics } from '@/services/networking/evm/types.js'
import { findLogInTx } from '@/services/networking/evm/utils.js'
import { BlockEvent } from '@/services/networking/substrate/types.js'
import { NetworkURN } from '@/services/types.js'
import { matchEvent } from '../../xcm/ops/util.js'
import hostAbi from '../abis/evm-host.json' with { type: 'json' }
import gatewayFunctionsAbi from '../abis/gateway-functions.json' with { type: 'json' }
import { INTENT_GATEWAYS, TOKEN_GATEWAYS } from '../config.js'
import {
  EvmPostRequestEvent,
  IntentOrder,
  IsmpPostRequestWithContext,
  SubstrateOffchainRequest,
  SubstratePostRequestEvent,
} from '../types.js'
import { toCommitmentHash, toFormattedNetwork, toIntentCommitmentHash, toTimeoutMillis } from './common.js'

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

export function extractEvmRequest(
  chainId: NetworkURN,
  getTransactionReceipt: (txHash: HexString) => Promise<TransactionReceipt>,
) {
  const tokenGateway = TOKEN_GATEWAYS[chainId]
  const intentGateway = INTENT_GATEWAYS[chainId]

  const gateways = [tokenGateway, intentGateway].filter((g): g is HexString => g !== undefined)
  if (gateways.length === 0) {
    throw new Error(`No gateway contracts defined for chain ${chainId}`)
  }

  return (source: Observable<Block>): Observable<IsmpPostRequestWithContext> => {
    return source.pipe(
      filterTransactions({ abi: gatewayFunctionsAbi as Abi, addresses: gateways }, ['teleport', 'fillOrder']),
      mergeMap((tx) =>
        from(getTransactionReceipt(tx.hash)).pipe(
          map((receipt) => ({ ...tx, receipt }) as DecodedTxWithReceipt),
        ),
      ),
      map((tx) => {
        const postRequestEvent = findLogInTx(tx, hostAbi as Abi, 'PostRequestEvent')
        if (!postRequestEvent || tx.blockHash === null || tx.blockNumber === null) {
          return null
        }

        try {
          const { eventName, args: eventArgs } = decodeEventLog({
            abi: hostAbi as Abi,
            topics: postRequestEvent.topics as LogTopics,
            data: postRequestEvent.data,
          }) as unknown as EvmPostRequestEvent

          const { source, dest, from, to, nonce, timeoutTimestamp, body } = eventArgs
          return {
            chainId,
            blockHash: tx.blockHash,
            blockNumber: tx.blockNumber.toString(),
            timestamp: tx.timestamp,
            txHash: tx.hash ?? undefined,
            txPosition: tx.transactionIndex ?? undefined,
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
              args: asSerializable(eventArgs),
            },
          } as IsmpPostRequestWithContext
        } catch (err) {
          console.error(
            err,
            `Error processing teleport chainId=${chainId} tx=${tx.hash} block=${tx.blockNumber.toString()}`,
          )
          return null
        }
      }),
      filter((msg) => msg !== null),
    )
  }
}
