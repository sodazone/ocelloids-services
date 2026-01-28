import z from 'zod'
import { $NetworkString } from '@/common/types.js'
import { uniqueArray } from '@/common/util.js'
import { BlockEvent, BlockExtrinsic } from '@/services/networking/substrate/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'

export const $TransfersAgentInputs = z.object({
  networks: z.literal('*').or(z.array($NetworkString).transform(uniqueArray)),
})

export type TransfersAgentInputs = z.infer<typeof $TransfersAgentInputs>

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
