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

export function extractEvmLogs(abi: Abi) {
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
          decoded: decodeEvmEventLog({
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
  { abi, addresses }: { abi?: Abi; addresses: string[] } = {
    addresses: [],
  },
) {
  return (source: Observable<BlockExtrinsicWithEvents>): Observable<BlockEvmTransaction> => {
    return source.pipe(
      filter((xt) => isFrontierExtrinsic(xt)),
      mergeMap(async (xt) => {
        const fxt = xt.args as FrontierExtrinsic
        const logs =
          abi === undefined
            ? undefined
            : xt.events
                .filter(isEVMLog)
                .map(
                  ({
                    value: {
                      log: { address, topics, data },
                    },
                  }) =>
                    addresses.includes(address) &&
                    decodeEvmEventLog({
                      data,
                      topics,
                      abi,
                    }),
                )
                .filter(Boolean)
        const execEvent = xt.events.find((ev) => ev.module === 'Ethereum' && ev.name === 'Executed')
        const executed = execEvent?.value
        const to = fxt.transaction.value.action.value
        return {
          ...xt,
          executed,
          logs,
          to,
          from: await getFromAddress(fxt),
          value: BigInt(fxt.transaction.value.value[0]),
          input: fxt.transaction.value.input,
          decoded:
            abi === undefined
              ? undefined
              : addresses.includes(to)
                ? decodeEvmFunctionData({ data: fxt.transaction.value.input, abi })
                : undefined,
        } as BlockEvmTransaction
      }),
    )
  }
}
