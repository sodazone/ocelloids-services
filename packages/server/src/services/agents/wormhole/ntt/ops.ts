import { filter, map, Observable } from 'rxjs'
import { Abi } from 'viem'
import { enrichLogWithTimestamp, filterAndDecodeLogs } from '@/services/networking/evm/rx/extract.js'
import { EvmLog } from '@/services/networking/evm/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import nttManagerAbi from '../abis/ntt-manager.json' with { type: 'json' }

type TransferRedeemedLog = {
  digest: HexString
}

export type TransferRedeemedPayload = {
  digest: HexString
  chainId: NetworkURN
  blockNumber: string
  blockHash: string
  txHash?: string
  timestamp: number
}

const NTT_MANAGER_ADDRESSES: HexString[] = [
  // We are filtering by name since there are multiple Managers
  // '0xcfd576f88c90844aebf45378fd09931281d8b14d'
]

export function extractNttTransferRedeemed(
  chainId: NetworkURN,
  getBlockTimestamp: (blockNumber: bigint | string) => Promise<number>,
) {
  return (source: Observable<EvmLog>): Observable<TransferRedeemedPayload> => {
    return source.pipe(
      filterAndDecodeLogs({ abi: nttManagerAbi as Abi, addresses: NTT_MANAGER_ADDRESSES }, [
        'TransferRedeemed',
      ]),
      enrichLogWithTimestamp(chainId, getBlockTimestamp),
      map(({ args, blockHash, blockNumber, timestamp, transactionHash }) => {
        if (!args || blockHash === null || blockNumber === null) {
          return null
        }

        const { digest } = args as TransferRedeemedLog
        return {
          digest,
          chainId,
          blockNumber,
          blockHash,
          txHash: transactionHash ?? undefined,
          timestamp,
        }
      }),
      filter((e) => e !== null),
    )
  }
}
