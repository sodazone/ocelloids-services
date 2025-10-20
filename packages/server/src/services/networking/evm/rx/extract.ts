import { combineLatest, filter, from, map, mergeMap, Observable, toArray } from 'rxjs'
import { Abi, AbiEvent, decodeEventLog, decodeFunctionData, toEventSelector, toFunctionSelector } from 'viem'

import { BlockWithLogs, DecodedLog, DecodedTx, DecodedTxWithLogs } from '../types.js'

const MAX_CONCURRENCY_LOGS = 10
const MAX_CONCURRENCY_TX = 10

export type DecodeContractParams = { abi: Abi; addresses: string[] }

export type FilterContractEventsParams = { abiSelectorMap: Record<string, AbiEvent>; addresses?: string[] }

function buildAbiMap(params: DecodeContractParams[]): Map<string, Abi> {
  const map = new Map<string, Abi>()
  for (const p of params) {
    for (const addr of p.addresses) {
      map.set(addr.toLowerCase(), p.abi)
    }
  }
  return map
}

function buildAbiSelectorMap({ abi }: DecodeContractParams, type: 'logs' | 'txs') {
  switch (type) {
    case 'logs': {
      return Object.fromEntries(
        abi.filter((item) => item.type === 'event').map((ev) => [toEventSelector(ev), ev]),
      )
    }
    case 'txs': {
      return Object.fromEntries(
        abi.filter((item) => item.type === 'function').map((tx) => [toFunctionSelector(tx), tx]),
      )
    }
    default: {
      throw new Error(`Type ${type} not supported for building ABI selector map.`)
    }
  }
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

export function filterLogs(params: DecodeContractParams) {
  const addressFilter = params.addresses ? params.addresses.map((a) => a.toLowerCase()) : []
  return (source: Observable<BlockWithLogs>): Observable<DecodedLog> =>
    source.pipe(
      mergeMap((block) => block.logs, MAX_CONCURRENCY_LOGS),
      map((log) => {
        const { address, topics, data } = log
        if (addressFilter.length > 0 && !addressFilter.includes(address)) {
          return null
        }

        const topic0 = topics[0]
        if (typeof topic0 === 'undefined' || data === '0x') {
          return null
        }

        const abiSelectorMap = buildAbiSelectorMap(params, 'logs')
        const ev = abiSelectorMap[topic0]
        if (!ev) {
          return null
        }

        let decoded: DecodedLog['decoded']

        try {
          const event = decodeEventLog({ abi: [ev], topics: log.topics, data: log.data })
          decoded = { eventName: event.eventName, args: event.args }
          return { ...log, decoded } as DecodedLog
        } catch (err) {
          console.warn(`[${log.address}] failed to decode log:`, err)
          return null
        }
      }),
      filter((log) => log !== null),
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

export function filterTransactions(params: DecodeContractParams, functionNames: string[] = []) {
  const addressFilter = params.addresses ? params.addresses.map((a) => a.toLowerCase()) : []

  return (source: Observable<BlockWithLogs>): Observable<DecodedTx> =>
    source.pipe(
      mergeMap((block) => block.transactions, MAX_CONCURRENCY_TX),
      map((tx) => {
        const { to, input } = tx

        if (!to || (addressFilter.length > 0 && !addressFilter.includes(to.toLowerCase()))) {
          return null
        }

        if (!input || input === '0x') {
          return null
        }

        const selector = input.slice(0, 10)
        const abiSelectorMap = buildAbiSelectorMap(params, 'txs')
        const fn = abiSelectorMap[selector]
        if (!fn) {
          return null
        }

        let decoded: DecodedTx['decoded']
        try {
          const func = decodeFunctionData({ abi: [fn], data: input })
          decoded = { functionName: func.functionName, args: func.args }
          return { ...tx, decoded } as DecodedTx
        } catch (err) {
          console.warn(`[${to}] failed to decode tx:`, err)
          return null
        }
      }),
      filter((tx): tx is DecodedTx => {
        if (tx === null) {
          return false
        }
        if (functionNames.length > 0 && !functionNames.includes(tx.decoded?.functionName ?? '')) {
          return false
        }
        return true
      }),
    )
}

function attachLogsToTransactions(decodedTxs: DecodedTx[], decodedLogs: DecodedLog[]): DecodedTxWithLogs[] {
  const logsByTxHash = new Map<string, DecodedLog[]>()
  for (const log of decodedLogs) {
    if (!log.transactionHash) {
      continue
    }
    const arr = logsByTxHash.get(log.transactionHash) ?? []
    arr.push(log)
    logsByTxHash.set(log.transactionHash, arr)
  }

  return decodedTxs.map((tx) => ({
    ...tx,
    logs: logsByTxHash.get(tx.hash) ?? [],
  }))
}

export function filterTransactionsWithLogs(params: DecodeContractParams, functionNames: string[] = []) {
  const txFilter = filterTransactions(params, functionNames)
  const logFilter = filterLogs(params)

  return (source: Observable<BlockWithLogs>): Observable<DecodedTxWithLogs> =>
    source.pipe(
      mergeMap((block) =>
        combineLatest([
          from([block]).pipe(txFilter, toArray()),
          from([block]).pipe(logFilter, toArray()),
        ]).pipe(map(([decodedTxs, decodedLogs]) => attachLogsToTransactions(decodedTxs, decodedLogs))),
      ),
      mergeMap((txs) => txs),
      filter((tx) => tx.decoded !== undefined),
    )
}
