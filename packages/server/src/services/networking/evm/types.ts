import { GetBlockReturnType, Hex, Log, Transaction, TransactionReceipt } from 'viem'
import { Serializable } from '@/common/util.js'

type BlockWithTransactions = GetBlockReturnType<undefined, true>

type SerializableLogs = Omit<Serializable<Log>, 'topics'> & {
  topics: [] | [signature: `0x${string}`, ...args: Hex[]]
}
export type BlockWithLogs = Serializable<BlockWithTransactions> & {
  logs: SerializableLogs[]
}

export type TransactionWithTimestamp = Serializable<Transaction> & { timestamp: number }

export type DecodedLog = SerializableLogs & {
  decoded?: {
    eventName?: string
    args?: Record<string, unknown> | readonly unknown[]
  }
}

export type DecodedTx = TransactionWithTimestamp & {
  decoded?: {
    functionName?: string
    args?: Record<string, unknown> | readonly unknown[]
  }
}

export type WithLogs = { logs: DecodedLog[] }
export type WithReceipt = { receipt: TransactionReceipt }

export type DecodedTxWithLogs = DecodedTx & WithLogs
export type DecodedTxWithReceipt = DecodedTx & WithReceipt
export type DecodedTxWithLogsAndReceipt = DecodedTx & WithLogs & WithReceipt
