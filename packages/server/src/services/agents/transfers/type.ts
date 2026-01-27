import { BlockEvent, BlockExtrinsic } from '@/services/networking/substrate/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'

export type Transfer = {
  asset: string
  from: HexString
  to: HexString
  amount: string
  blockNumber: string
  blockHash: string
  timestamp?: number
  event: BlockEvent
  extrinsic?: BlockExtrinsic
}

export type EnrichedTransfer = Transfer & {
  chainId: NetworkURN
  decimals?: number
  symbol?: string
  volume?: number
}
