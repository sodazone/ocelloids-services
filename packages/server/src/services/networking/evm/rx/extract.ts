import { catchError, combineLatest, EMPTY, filter, from, map, mergeMap, Observable, toArray } from 'rxjs'
import {
  Abi,
  AbiEvent,
  AbiFunction,
  decodeEventLog,
  decodeFunctionData,
  toEventSelector,
  toFunctionSelector,
} from 'viem'
import { retryWithTruncatedExpBackoff } from '@/common/index.js'
import { asSerializable } from '@/common/util.js'
import { retryCapped } from '../../watcher.js'
import {
  Block,
  BlockWithLogs,
  DecodeContractParams,
  DecodedLog,
  DecodedLogParams,
  DecodedLogWithTimestamp,
  DecodedTx,
  DecodedTxWithLogs,
  EvmLog,
  TransactionWithTimestamp,
} from '../types.js'

const MAX_CONCURRENCY_LOGS = 10
const MAX_CONCURRENCY_TX = 10

type LogTopics = [] | [signature: `0x${string}`, ...args: `0x${string}`[]]

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

function getTransactionsWithTimestamp(block: BlockWithLogs | Block): TransactionWithTimestamp[] {
  return block.transactions.map((tx) => ({ ...tx, timestamp: Number(block.timestamp) * 1_000 }))
}

export function decodeLogs(params: DecodeContractParams[]) {
  const abiMap = buildAbiMap(params)

  return (source: Observable<BlockWithLogs>): Observable<DecodedLog> =>
    source.pipe(
      mergeMap((block) => block.logs, MAX_CONCURRENCY_LOGS),
      map((log) => {
        const abi = abiMap.get(log.address.toLowerCase())
        let decoded: DecodedLogParams = {}

        if (abi) {
          try {
            const event = decodeEventLog({ abi, topics: log.topics as LogTopics, data: log.data })
            decoded = { eventName: event.eventName, args: event.args }
          } catch (err) {
            console.warn(`[${log.address}] failed to decode log:`, err)
          }
        }

        return asSerializable({ ...log, ...decoded }) as DecodedLog
      }),
    )
}

function decodeLog(
  log: EvmLog,
  addressFilterSet: Set<string>,
  eventNameSet: Set<string>,
  abiSelectorMap:
    | {
        [k: string]: AbiEvent
      }
    | {
        [k: string]: AbiFunction
      },
): DecodedLog | null {
  if (addressFilterSet.size > 0 && !addressFilterSet.has(log.address.toLowerCase())) {
    return null
  }

  const topic0 = log.topics?.[0]
  if (!topic0) {
    return null
  }

  const ev = abiSelectorMap[topic0]
  if (!ev) {
    return null
  }

  if (eventNameSet.size > 0 && !eventNameSet.has(ev.name)) {
    return null
  }

  try {
    const event = decodeEventLog({
      abi: [ev],
      topics: log.topics as LogTopics,
      data: log.data === '0x' ? undefined : log.data,
    })

    return asSerializable({
      ...log,
      eventName: event.eventName,
      args: event.args,
    }) as DecodedLog
  } catch (err) {
    console.warn(`[${log.address}] failed to decode log:`, err)
    return null
  }
}

/** Prepares fast lookup filters and ABI selector map */
function prepareLogDecoderConfig(params: DecodeContractParams, eventNames: string[]) {
  return {
    addressSet: new Set(params.addresses?.map((a) => a.toLowerCase()) ?? []),
    eventNameSet: new Set(eventNames),
    abiSelectorMap: buildAbiSelectorMap(params, 'logs'),
  }
}

export function filterAndDecodeLogs(params: DecodeContractParams, eventNames: string[] = []) {
  const { addressSet, eventNameSet, abiSelectorMap } = prepareLogDecoderConfig(params, eventNames)

  return (source: Observable<EvmLog>): Observable<DecodedLog> =>
    source.pipe(
      mergeMap((log) => {
        const decoded = decodeLog(log, addressSet, eventNameSet, abiSelectorMap)
        return decoded ? [decoded] : EMPTY
      }),
    )
}

export function filterLogs(params: DecodeContractParams, eventNames: string[] = []) {
  const { addressSet, eventNameSet, abiSelectorMap } = prepareLogDecoderConfig(params, eventNames)

  return (source: Observable<BlockWithLogs>): Observable<DecodedLogWithTimestamp> =>
    source.pipe(
      mergeMap((block) => {
        const timestampMs = Number(block.timestamp) * 1_000
        return from(block.logs ?? []).pipe(map((log) => ({ log, timestampMs })))
      }, MAX_CONCURRENCY_LOGS),
      mergeMap(({ log, timestampMs }) => {
        const decoded = decodeLog(log, addressSet, eventNameSet, abiSelectorMap)
        if (!decoded) {
          return EMPTY
        }

        return [
          {
            ...decoded,
            timestamp: timestampMs,
          } as DecodedLogWithTimestamp,
        ]
      }),
    )
}

export function enrichLogWithTimestamp(
  chainId: string,
  fetcher: (height: bigint | string) => Promise<number>,
): (source$: Observable<DecodedLog>) => Observable<DecodedLogWithTimestamp> {
  const inFlightRequests = new Map<string, Promise<number>>()

  const getDeduplicatedTimestampMs = (height: bigint | string): Promise<number> => {
    const key = String(height)
    const existing = inFlightRequests.get(key)
    if (existing) {
      return existing
    }

    const promise = fetcher(height).finally(() => {
      inFlightRequests.delete(key)
    })

    inFlightRequests.set(key, promise)
    return promise
  }

  return (source$: Observable<DecodedLog>) =>
    source$.pipe(
      mergeMap((log) => {
        if (log.blockNumber === null || log.blockNumber === undefined) {
          console.warn(`[${chainId}] Log missing blockNumber:`, log)
          return EMPTY
        }

        if (log.blockTimestamp && log.blockTimestamp !== '0') {
          return [
            {
              ...log,
              timestamp: Number(log.blockTimestamp) * 1_000,
            } as DecodedLogWithTimestamp,
          ]
        }

        return from(getDeduplicatedTimestampMs(log.blockNumber)).pipe(
          retryWithTruncatedExpBackoff(retryCapped(5)),
          map(
            (ts) =>
              ({
                ...log,
                timestamp: ts,
              }) as DecodedLogWithTimestamp,
          ),
          catchError((err) => {
            console.error(err, `[${chainId}] Failed to resolve timestamp for block ${log.blockNumber}:`)
            return EMPTY
          }),
        )
      }),
    )
}

export function decodeTransactions(params: DecodeContractParams[]) {
  const abiMap = buildAbiMap(params)

  return (source: Observable<BlockWithLogs | Block>): Observable<DecodedTx> =>
    source.pipe(
      mergeMap((block) => getTransactionsWithTimestamp(block), MAX_CONCURRENCY_TX),
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

        return asSerializable({ ...tx, decoded }) as DecodedTx
      }),
    )
}

export function filterTransactions(params: DecodeContractParams, functionNames: string[] = []) {
  const addressFilter = params.addresses ? params.addresses.map((a) => a.toLowerCase()) : []

  return (source: Observable<BlockWithLogs | Block>): Observable<DecodedTx> =>
    source.pipe(
      mergeMap((block) => getTransactionsWithTimestamp(block), MAX_CONCURRENCY_TX),
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
          decoded = { functionName: func.functionName, args: asSerializable(func.args) }
          return asSerializable({ ...tx, decoded }) as DecodedTx
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
