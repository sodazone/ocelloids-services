import { catchError, concatMap, EMPTY, filter, from, map, Observable } from 'rxjs'
import { Abi } from 'viem'
import { enrichLogWithTimestamp, filterAndDecodeLogs } from '@/services/networking/evm/rx/extract.js'
import { EvmLog } from '@/services/networking/evm/types.js'
import {
  getTransactionFunctionCallArgs,
  isNearTransactionSuccess,
  rlpToNearCallArgs,
} from '@/services/networking/near/extract.js'
import { NearTransaction, NearTxStatus } from '@/services/networking/near/types.js'
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
  timestamp: number
  txHash?: string
  recipient?: string
}

const NTT_MANAGER_ADDRESSES: HexString[] = [
  // We are filtering by name since there are multiple Managers
  // '0xcfd576f88c90844aebf45378fd09931281d8b14d'
]

const NEAR_NTT_MANAGER_ADDRESSES: string[] = ['ntt-zec.hydration-whm.near', 'ntt-near.hydration-whm.near']

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

function mapNearNttTransferRedeemed({
  chainId,
  tx,
  txResult,
}: {
  chainId: NetworkURN
  tx: NearTransaction
  txResult: NearTxStatus
}): TransferRedeemedPayload | null {
  if (!txResult?.receipts_outcome) {
    return null
  }

  const transferEvent = txResult.receipts_outcome
    .filter((r) => NEAR_NTT_MANAGER_ADDRESSES.includes(r.outcome.executor_id))
    .flatMap((r) => r.outcome.logs)
    .map((log) => {
      if (!log.startsWith('EVENT_JSON:')) {
        return null
      }
      try {
        return JSON.parse(log.slice('EVENT_JSON:'.length))
      } catch {
        return null
      }
    })
    .find((event) => event?.event === 'transfer_received' && event?.data?.[0]?.digest)

  if (!transferEvent) {
    return null
  }

  const data = transferEvent.data[0]

  if (!data.digest) {
    return null
  }

  return {
    digest: `0x${data.digest}`,
    chainId,
    blockNumber: tx.blockNumber.toString(),
    blockHash: tx.blockHash,
    timestamp: tx.timestamp,
    txHash: tx.hash,
    recipient: data.account,
  }
}

function isHydrationNttMessage(tx: NearTransaction): boolean {
  try {
    const rlp = getTransactionFunctionCallArgs(tx).find((c) => c.methodName === 'rlp_execute')
    if (!rlp) {
      return false
    }
    const callB64 = rlp.args['tx_bytes_b64']
    if (!callB64) {
      return false
    }
    const decoded = rlpToNearCallArgs(callB64)

    if (decoded === null) {
      return false
    }

    return decoded.method === 'ntt' && decoded.target === 'hydration-whm.near'
  } catch (_e) {
    return false
  }
}

export function extractNearNttTransferRedeemed(
  chainId: NetworkURN,
  getTransactionStatus: (txHash: string, senderAccountId: string) => Promise<NearTxStatus>,
) {
  return (source: Observable<NearTransaction>): Observable<TransferRedeemedPayload> => {
    return source.pipe(
      filter((tx) => NEAR_NTT_MANAGER_ADDRESSES.includes(tx.receiver_id) || isHydrationNttMessage(tx)),
      concatMap((tx) =>
        from(getTransactionStatus(tx.hash, tx.signer_id)).pipe(
          map((txResult) => {
            if (isNearTransactionSuccess(txResult)) {
              return mapNearNttTransferRedeemed({ chainId, tx, txResult })
            }
            return null
          }),
          filter((payload): payload is TransferRedeemedPayload => payload !== null),
          catchError((err) => {
            console.error(err, `Failed to process Near tx ${tx.hash}`)
            return EMPTY
          }),
        ),
      ),
    )
  }
}
