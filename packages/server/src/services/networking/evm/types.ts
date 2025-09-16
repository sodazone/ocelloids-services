import { GetBlockReturnType, Log } from 'viem'

type BlockWithTransactions = GetBlockReturnType<undefined, true>

export type BlockWithLogs = BlockWithTransactions & {
  logs: Log[]
}
