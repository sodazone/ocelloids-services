import { Observable, filter, map, mergeMap } from 'rxjs'
import { Abi } from 'viem'

import {
  FrontierExtrinsic,
  decodeEvmEventLog,
  decodeEvmFunctionData,
  getFromAddress,
  isEVMLog,
  isFrontierExtrinsic,
} from '@/common/evm/index.js'
import {
  BlockEvent,
  BlockEvmEvent,
  BlockEvmTransaction,
  BlockExtrinsicWithEvents,
} from '@/services/networking/types.js'

type DecodeContractParams = { abi?: Abi; addresses: string[] }

export function extractEvmLogs(
  { abi }: DecodeContractParams = {
    addresses: [],
  },
) {
  return (source: Observable<BlockEvent>): Observable<BlockEvmEvent> => {
    return source.pipe(
      filter((ev) => isEVMLog(ev)),
      map((event) => {
        const { address, topics, data } = event.value.log
        return {
          ...event,
          address,
          topics,
          data,
          decoded:
            abi === undefined
              ? undefined
              : decodeEvmEventLog({
                  abi,
                  topics,
                  data,
                }),
        } as BlockEvmEvent
      }),
    )
  }
}

export function extractEvmTransactions(
  { abi, addresses }: DecodeContractParams = {
    addresses: [],
  },
) {
  return (source: Observable<BlockExtrinsicWithEvents>): Observable<BlockEvmTransaction> => {
    return source.pipe(
      filter((xt) => isFrontierExtrinsic(xt)),
      mergeMap(async (xt) => {
        const fxt = xt.args as FrontierExtrinsic
        const { events } = xt
        const { transaction } = fxt

        const logs = abi
          ? events
              .filter(isEVMLog)
              .map(
                ({
                  value: {
                    log: { address, topics, data },
                  },
                }) => (addresses.includes(address) ? decodeEvmEventLog({ data, topics, abi }) : null),
              )
              .filter(Boolean)
          : undefined

        const executed = events.find((ev) => ev.module === 'Ethereum' && ev.name === 'Executed')?.value

        const to = transaction.value.action.value
        const from = await getFromAddress(fxt)
        const value = BigInt(transaction.value.value[0])
        const input = transaction.value.input

        const decoded =
          abi && addresses.includes(to) ? decodeEvmFunctionData({ data: input, abi }) : undefined

        return {
          ...xt,
          executed,
          logs,
          to,
          from,
          value,
          input,
          decoded,
        } as BlockEvmTransaction
      }),
    )
  }
}
