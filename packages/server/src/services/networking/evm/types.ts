import { GetBlockReturnType, Log, Transaction } from 'viem'

type BlockWithTransactions = GetBlockReturnType<undefined, true>

export type BlockWithLogs = BlockWithTransactions & {
  logs: Log[]
}

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

export type DecodedTxWithLogs = DecodedTx & { logs: DecodedLog[] }
