import { GetBlockReturnType, Log, Transaction, TransactionReceipt } from 'viem'

type BlockWithTransactions = GetBlockReturnType<undefined, true>

export type BlockWithLogs = BlockWithTransactions & {
  logs: Log[]
}

export type TransactionWithTimestamp = Transaction & { timestamp: number }

export type DecodedLog = Log & {
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
