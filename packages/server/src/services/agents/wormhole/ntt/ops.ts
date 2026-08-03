import { filter, map, Observable } from 'rxjs'
import { Abi } from 'viem'
import { filterLogs } from '@/services/networking/evm/rx/extract.js'
import { BlockWithLogs } from '@/services/networking/evm/types.js'
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

export function extractNttTransferRedeemed(chainId: NetworkURN, contractAddresses: HexString[]) {
  return (source: Observable<BlockWithLogs>): Observable<TransferRedeemedPayload> => {
    return source.pipe(
      filterLogs({ abi: nttManagerAbi as Abi, addresses: contractAddresses }, ['TransferRedeemed']),
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
