import { catchError, EMPTY, filter, from, map, mergeMap, Observable } from 'rxjs'
import { Abi, padHex, TransactionReceipt } from 'viem'
import { normalizePublicKey, retryWithTruncatedExpBackoff } from '@/common/index.js'
import { filterLogs } from '@/services/networking/evm/rx/extract.js'
import { BlockWithLogs, DecodedLogWithTxReceipt } from '@/services/networking/evm/types.js'
import { retryCapped } from '@/services/networking/watcher.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import { networks } from '../../common/networks.js'
import { WormholeChainIds } from '../../steward/metadata/queries/wormhole.js'
import basejumpAbi from '../abis/basejump.json' with { type: 'json' }
import { BasejumpInitiatedWithContext } from '../types.js'

type BridgeInitiatedLog = {
  asset: HexString
  amount: bigint
  fee: bigint
  destChain: number
  recipient: HexString
  transferSequence: bigint
  messageSequence: bigint
}

export function extractBasejumpEvmOutbound(
  chainId: NetworkURN,
  contractAddress: HexString,
  getTransactionReceipt: (txHash: HexString) => Promise<TransactionReceipt>,
) {
  return (source: Observable<BlockWithLogs>): Observable<BasejumpInitiatedWithContext> => {
    return source.pipe(
      filterLogs({ abi: basejumpAbi as Abi, addresses: [contractAddress] }, ['BridgeInitiated']),
      filter((log) => log.transactionHash !== null),
      mergeMap((log) =>
        from(getTransactionReceipt(log.transactionHash!)).pipe(
          retryWithTruncatedExpBackoff(retryCapped(3)),
          catchError((err) => {
            console.error(
              err,
              `[basejump:${chainId}] Error getting transaction receipt at #${log.blockNumber} (tx=${log.transactionHash})`,
            )
            return EMPTY
          }),
          map((receipt) => ({ ...log, receipt }) as DecodedLogWithTxReceipt),
        ),
      ),
      map(({ address, args, blockHash, blockNumber, timestamp, transactionHash, receipt }) => {
        const emitterChain = WormholeChainIds[chainId]

        if (!args || !emitterChain || blockHash === null || blockNumber === null) {
          return null
        }

        const { amount, asset, messageSequence, recipient, fee } = args as BridgeInitiatedLog
        const vaaId = `${emitterChain}/${padHex(address).slice(2)}/${messageSequence}`
        const sender = receipt.from

        return {
          vaaId,
          chainId,
          destination: networks.hydration,
          sender: normalizePublicKey(sender),
          recipient: normalizePublicKey(recipient),
          blockNumber,
          blockHash,
          asset: asset.toLowerCase() as HexString,
          amount: (amount - fee).toString(),
          fee: fee.toString(),
          txHash: transactionHash ?? undefined,
          timestamp,
        }
      }),
      filter((e) => e !== null),
    )
  }
}
