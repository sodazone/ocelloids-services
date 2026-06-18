import { filter, map, Observable } from 'rxjs'
import { Abi, decodeEventLog, Log, toEventSelector } from 'viem'
import { normalizePublicKey } from '@/common/index.js'
import { BlockEvent, BlockEvmEvent } from '@/services/networking/substrate/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import basejumpLandingAbi from '../abis/basejump-landing.json' with { type: 'json' }
import {
  BasejumpExecutedWithContext,
  BasejumpLandedWithContext,
  BasejumpPendingWithContext,
} from '../types.js'

type TransferExecutedArgs = {
  sourceAsset: HexString
  destAsset: HexString
  recipient: HexString
  amount: bigint
}

type TransferPendingArgs = TransferExecutedArgs & {
  id: bigint
}

const eventSelectorRegistry = new Map(
  (basejumpLandingAbi as Abi)
    .filter((item) => item.type === 'event')
    .map((ev) => [toEventSelector(ev), [ev]]),
)

export function extractBasejumpLanding(chainId: NetworkURN, contractAddress: HexString) {
  return (source: Observable<BlockEvent>): Observable<BasejumpLandedWithContext> => {
    return source.pipe(
      filter((e) => e.module.toLowerCase() === 'evm' && e.name.toLowerCase() === 'log'),
      map((event) => {
        const { address, topics, data } = event.value.log as Log
        const topic0 = topics[0]
        if (address !== contractAddress || typeof topic0 === 'undefined' || data === '0x' || !topic0) {
          return null
        }

        const entry = eventSelectorRegistry.get(topic0)
        if (!entry) {
          return null
        }
        try {
          const decoded = decodeEventLog({
            abi: entry,
            data,
            topics,
          })

          return {
            ...event,
            address,
            topics,
            data,
            decoded,
          } as BlockEvmEvent
        } catch (_e) {
          return null
        }
      }),
      filter((event) => event !== null),
      map(({ blockHash, blockNumber, extrinsic, timestamp, decoded }) => {
        if (blockHash === null || blockNumber === null || !decoded) {
          return null
        }
        if (decoded.eventName === 'TransferQueued' || decoded.eventName === 'PendingTransferFulfilled') {
          const { id, sourceAsset, recipient, amount } = decoded.args as TransferPendingArgs
          const msg: BasejumpPendingWithContext = {
            type: decoded.eventName === 'TransferQueued' ? 'queued' : 'fulfilled',
            chainId,
            blockNumber: blockNumber.toString(),
            blockHash: blockHash as HexString,
            txHash: extrinsic?.hash as HexString,
            txHashSecondary: extrinsic?.evmTxHash as HexString,
            timestamp,
            outcome: 'Success',
            recipient: normalizePublicKey(recipient),
            asset: sourceAsset.toLowerCase(),
            amount: amount.toString(),
            id: id.toString(),
          }
          return msg
        }
        if (decoded.eventName === 'TransferExecuted') {
          const { sourceAsset, recipient, amount } = decoded.args as TransferExecutedArgs
          const msg: BasejumpExecutedWithContext = {
            type: 'executed',
            chainId,
            blockNumber: blockNumber.toString(),
            blockHash: blockHash as HexString,
            txHash: extrinsic?.hash as HexString,
            txHashSecondary: extrinsic?.evmTxHash as HexString,
            timestamp,
            outcome: 'Success',
            recipient: normalizePublicKey(recipient),
            asset: sourceAsset.toLowerCase(),
            amount: amount.toString(),
          }
          return msg
        }
        return null
      }),
      filter((msg) => msg !== null),
    )
  }
}
