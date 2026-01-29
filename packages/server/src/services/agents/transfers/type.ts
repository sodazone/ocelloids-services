import { Subscription as RxSubscription } from 'rxjs'
import z from 'zod'
import { ControlQuery } from '@/common/index.js'
import { $NetworkString } from '@/common/types.js'
import { uniqueArray } from '@/common/util.js'
import { HexString, Subscription } from '@/services/subscriptions/types.js'
import { AnyJson, NetworkURN } from '@/services/types.js'

export const $TransfersAgentInputs = z.object({
  networks: z.literal('*').or(z.array($NetworkString).transform(uniqueArray)),
})

export type TransfersAgentInputs = z.infer<typeof $TransfersAgentInputs>

export type TransfersSubscriptionHandler = {
  networksControl: ControlQuery
  subscription: Subscription<TransfersAgentInputs>
  stream: RxSubscription
}

/**
 * @public
 */
export type Transfer = {
  asset: string
  from: HexString
  to: HexString
  amount: string
  blockNumber: string
  blockHash: string
  timestamp?: number
  event: AnyJson
  extrinsic?: AnyJson
}

/**
 * @public
 */
export type EnrichedTransfer = Transfer & {
  chainId: NetworkURN
  decimals?: number
  symbol?: string
  volume?: number
}
