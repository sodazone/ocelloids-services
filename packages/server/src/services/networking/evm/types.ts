import { Abi, GetBlockReturnType, Log, Transaction, TransactionReceipt } from 'viem'
import { Serializable } from '@/common/util.js'
import { HexString } from '@/lib.js'

type BlockWithTransactions = GetBlockReturnType<undefined, true>

type SerializableLogs = Serializable<Log>

export type BlockWithLogs = Serializable<BlockWithTransactions> & {
  logs: SerializableLogs[]
}

export type Block = Serializable<BlockWithTransactions>

export type TransactionWithTimestamp = Serializable<Transaction> & { timestamp: number }

export type LogTopics = [] | [signature: `0x${string}`, ...args: `0x${string}`[]]

export type DecodedLogParams = {
  eventName?: string
  args?: Record<string, unknown> | readonly unknown[]
}

export type DecodedLog = SerializableLogs & DecodedLogParams

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

export type DecodeContractParams = { abi: Abi; addresses: HexString[] }
