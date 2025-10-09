import { filter, map, mergeMap, Observable } from 'rxjs'
import { Abi } from 'viem'

import {
  decodeEvmEventLog,
  decodeEvmFunctionData,
  FrontierExtrinsic,
  getFromAddress,
  isEVMLog,
  isFrontierExtrinsic,
} from '../evm/index.js'
import { BlockEvent, BlockEvmEvent, BlockEvmTransaction, BlockExtrinsicWithEvents } from '../types.js'

type DecodeContractParams = { abi: Abi; addresses: string[] }
const findAbi = (params: DecodeContractParams[] = [], address: string) => {
  return params.find((p) => p.addresses.includes(address))?.abi
}

export function extractEvmLogs(params: DecodeContractParams[]) {
  return (source: Observable<BlockEvent>): Observable<BlockEvmEvent> => {
    return source.pipe(
      filter((ev) => isEVMLog(ev)),
      map((event) => {
        const { address, topics, data } = event.value.log
        const abi = findAbi(params, address)
        const decoded = abi
          ? decodeEvmEventLog({
              abi,
              topics,
              data,
            })
          : undefined
        return {
          ...event,
          address,
          topics,
          data,
          decoded,
        } as BlockEvmEvent
      }),
    )
  }
}

export function extractEvmTransactions(params: DecodeContractParams[]) {
  return (source: Observable<BlockExtrinsicWithEvents>): Observable<BlockEvmTransaction> => {
    return source.pipe(
      filter((xt) => isFrontierExtrinsic(xt)),
      mergeMap(async (xt) => {
        const fxt = xt.args as FrontierExtrinsic
        const { events } = xt
        const { transaction } = fxt

        const logs =
          params.length > 0
            ? events
                .filter(isEVMLog)
                .map(
                  ({
                    value: {
                      log: { address, topics, data },
                    },
                  }) => {
                    const abi = findAbi(params, address)
                    return abi ? decodeEvmEventLog({ data, topics, abi }) : null
                  },
                )
                .filter(Boolean)
            : undefined

        const executed = events.find((ev) => ev.module === 'Ethereum' && ev.name === 'Executed')?.value

        const to = transaction.value.action.value
        const from = await getFromAddress(fxt)
        const value = BigInt(transaction.value.value[0])
        const input = transaction.value.input

        const abi = findAbi(params, to)
        const decoded = abi ? decodeEvmFunctionData({ data: input, abi }) : undefined

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
