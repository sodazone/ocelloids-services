import { ControlQuery } from '@/common/index.js'
import { AnyJson, HexString, NetworkURN } from '@/lib.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateApiContext } from '@/services/networking/substrate/types.js'
import { Observable } from 'rxjs'
import { AssetId, AssetMetadata } from '../types.js'

export type BalanceUpdateItem = { queueKey: string; data: BalancesQueueData }
export type BalancesStreamMapper = (
  ingress: SubstrateIngressConsumer,
  control: ControlQuery,
) => Observable<BalanceUpdateItem>[]

export type AccountBalancesData = {
  balance: bigint
  assetKeyHash: HexString
}

type BaseQueueData = {
  account: string
  publicKey: HexString
  assetKeyHash: HexString
}

export type StorageQueryParams = {
  module: string
  name: string
  storageKey: HexString
}

export type RuntimeQueryParams = {
  api: string
  method: string
  args: any[]
}

export type StorageQueueData = BaseQueueData &
  StorageQueryParams & {
    type: 'storage'
  }

export type RuntimeQueueData = BaseQueueData &
  RuntimeQueryParams & {
    type: 'runtime'
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

export type CustomDiscoveryFetcher = (ctx: {
  chainId: NetworkURN
  account: HexString
  ingress: SubstrateIngressConsumer
  apiCtx: SubstrateApiContext
}) => Promise<{ assetId: AssetId; balance: bigint | null }[]>

export type StorageKeyMapper = (
  asset: AssetMetadata,
  account: HexString,
  apiCtx: SubstrateApiContext,
) => StorageQueryParams | null

export type RuntimeCallMapper = (
  asset: AssetMetadata,
  account: HexString,
  apiCtx: SubstrateApiContext,
) => RuntimeQueryParams | null
