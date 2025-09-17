import { AnyJson, HexString, NetworkURN } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { Subscription } from 'rxjs'

export type BalancesSubscriptionMapper = (
  chainId: NetworkURN,
  ingress: SubstrateIngressConsumer,
  enqueue: EnqueueUpdateItem,
) => Subscription[]

export type BalanceQueueData = {
  module: string
  name: string
  account: HexString
  assetKeyHash: HexString
}
export type EnqueueUpdateItem = (chainId: NetworkURN, key: HexString, data: BalanceQueueData) => void

export type TokensBalance = {
  free: bigint
  reserved: bigint
  frozen: bigint
}

export type AssetsBalance = {
  balance: bigint
  status: AnyJson
  reason: AnyJson
  extra: AnyJson
}

export type NativeBalance = {
  nonce: number
  consumers: number
  providers: number
  sufficients: number
  data: TokensBalance
}
