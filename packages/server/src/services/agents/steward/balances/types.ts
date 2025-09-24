import { AnyJson, HexString, NetworkURN } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { Subscription } from 'rxjs'
import { AssetId, AssetMetadata } from '../types.js'

export type BalancesSubscriptionMapper = (
  ingress: SubstrateIngressConsumer,
  enqueue: EnqueueUpdateItem,
) => Subscription[]

export type AccountBalancesData = {
  balance: bigint
  assetKeyHash: HexString
}

export type StorageQueueData = {
  type: 'storage'
  module: string
  name: string
  account: string
  publicKey: HexString
  assetKeyHash: HexString
}

export type RuntimeQueueData = {
  type: 'runtime'
  api: string
  method: string
  args: any[]
  account: string
  publicKey: HexString
  assetKeyHash: HexString
}

export type BalancesQueueData = StorageQueueData | RuntimeQueueData

export type EnqueueUpdateItem = (chainId: NetworkURN, key: HexString, data: BalancesQueueData) => void

export type Balance = {
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
  data: Balance
}

export type BalancesFromStorage = { storageKey: HexString; module: string; name: string }
export type CustomDiscoveryFetcher = (ctx: {
  chainId: NetworkURN
  account: string
  ingress: SubstrateIngressConsumer
  apiCtx: SubstrateApiContext
}) => Promise<{ assetId: AssetId; balance: bigint }[]>

export type StorageKeyMapper = (
  asset: AssetMetadata,
  account: string,
  apiCtx: SubstrateApiContext,
) => BalancesFromStorage | null
