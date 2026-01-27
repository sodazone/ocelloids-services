import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'

export type Transfer = {
  asset: string
  from: HexString
  to: HexString
  amount: string
}

export type EnrichedTransfer = Transfer & {
  chainId: NetworkURN
}
