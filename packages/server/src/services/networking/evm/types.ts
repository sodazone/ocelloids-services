import { Block, Log } from 'viem'

export type BlockWithLogs = Block & {
  logs: Log[]
}
