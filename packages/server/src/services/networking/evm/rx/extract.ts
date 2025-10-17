import { map, mergeMap, Observable } from 'rxjs'
import { Abi, decodeEventLog, decodeFunctionData, Log, Transaction } from 'viem'

import { BlockWithLogs } from '../types.js'

const MAX_CONCURRENCY_LOGS = 10
const MAX_CONCURRENCY_TX = 10

export type DecodeContractParams = { abi: Abi; addresses: string[] }

export type DecodedLog = Log & {
  decoded?: {
    eventName?: string
    args?: Record<string, unknown> | readonly unknown[]
  }
}

export type DecodedTx = Transaction & {
  decoded?: {
    functionName?: string
    args?: Record<string, unknown> | readonly unknown[]
  }
}

function buildAbiMap(params: DecodeContractParams[]): Map<string, Abi> {
  const map = new Map<string, Abi>()
  for (const p of params) {
    for (const addr of p.addresses) {
      map.set(addr.toLowerCase(), p.abi)
    }
  }
  return map
}

export function decodeLogs(params: DecodeContractParams[]) {
  const abiMap = buildAbiMap(params)

  return (source: Observable<BlockWithLogs>): Observable<DecodedLog> =>
    source.pipe(
      mergeMap((block) => block.logs, MAX_CONCURRENCY_LOGS),
      map((log) => {
        const abi = abiMap.get(log.address.toLowerCase())
        let decoded: DecodedLog['decoded']

        if (abi) {
          try {
            const event = decodeEventLog({ abi, topics: log.topics, data: log.data })
            decoded = { eventName: event.eventName, args: event.args }
          } catch (err) {
            console.warn(`[${log.address}] failed to decode log:`, err)
          }
        }

        return { ...log, decoded } as DecodedLog
      }),
    )
}

export function decodeTransactions(params: DecodeContractParams[]) {
  const abiMap = buildAbiMap(params)

  return (source: Observable<BlockWithLogs>): Observable<DecodedTx> =>
    source.pipe(
      mergeMap((block) => block.transactions, MAX_CONCURRENCY_TX),
      map((tx) => {
        const abi = tx.to ? abiMap.get(tx.to.toLowerCase()) : undefined
        let decoded: DecodedTx['decoded']

        if (abi && tx.to) {
          try {
            const fn = decodeFunctionData({ abi, data: tx.input })
            decoded = { functionName: fn.functionName, args: fn.args }
          } catch (err) {
            console.warn(`[${tx.to}] failed to decode tx:`, err)
          }
        }

        return { ...tx, decoded } as DecodedTx
      }),
    )
}
