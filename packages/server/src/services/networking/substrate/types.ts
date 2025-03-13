export type { Decoder, Codec } from '@polkadot-api/substrate-bindings'
export type { BlockInfo, SystemEvent } from '@polkadot-api/observable-client'
export type { ChainSpecData } from '@polkadot-api/substrate-client'

import type { BlockInfo, SystemEvent } from '@polkadot-api/observable-client'
import type { Codec, Decoder } from '@polkadot-api/substrate-bindings'
import type { ChainSpecData } from '@polkadot-api/substrate-client'

import type { HexString } from '@/lib.js'

import { Optional } from '@/common/types.js'
import { ApiClient, BlockStatus } from '../types.js'

export type StorageCodec<T = any> = {
  keys: {
    enc: (...args: any[]) => string
    dec: (value: string) => any[]
  }
  value: Codec<T>
}

export type Event = {
  module: string
  name: string
  value: Record<string, any>
}

export type EventRecord<T = Event> = Omit<SystemEvent, 'event'> & {
  event: T
}

export type Extrinsic = {
  hash: string
  module: string
  method: string
  signed: boolean
  signature: any
  address: any
  args: Record<string, any>
  evmTxHash?: string
}

export type Block = {
  hash: string
  number: number
  parent: string
  extrinsics: Extrinsic[]
  events: EventRecord[]
  status: BlockStatus
}

export type BlockInfoWithStatus = Optional<BlockInfo, 'number' | 'parent'> & {
  status: BlockStatus
}

export type BlockContext = {
  blockNumber: number
  blockHash: string
  blockPosition: number
  timestamp?: number
}

export type BlockExtrinsic = Extrinsic & BlockContext

export type BlockEvent = Event &
  BlockContext & {
    extrinsic?: BlockExtrinsic
    extrinsicPosition?: number
  }

export type BlockEvmEvent = BlockEvent & {
  address: string
  topics: [string]
  data?: string
  decoded?: {
    eventName: string
    args?: any
  }
}

export type BlockExtrinsicWithEvents = BlockExtrinsic & {
  events: BlockEvent[]
  dispatchInfo: any
  dispatchError: any
}

export type BlockEvmTransaction = BlockExtrinsicWithEvents & {
  executed?: {
    from: string
    to: string
    transaction_hash: string
    exit_reason: { type: string; value: { type: string } }
    extra_data: string
  }
  to: string
  from: string
  value: bigint
  logs?: {
    eventName: string
    args: any[]
  }[]
  decoded?: {
    functionName: string
    args: any
  }
}

export interface SubstrateApi extends ApiClient {
  readonly ctx: SubstrateApiContext
  readonly isReady: () => Promise<SubstrateApi>
  readonly getChainSpecData: () => Promise<ChainSpecData>

  getMetadata(): Promise<Uint8Array>
  getRuntimeVersion(): Promise<{
    specName: string
    implName: string
    authoringVersion: number
    specVersion: number
    implVersion: number
  }>

  getBlock(hash: string): Promise<Block>
  getBlockHeader(hash: string): Promise<BlockInfo>

  getStorageKeys(
    keyPrefix: string,
    count: number,
    resolvedStartKey?: string,
    at?: string,
  ): Promise<HexString[]>

  getStorage(key: string, at?: string): Promise<HexString>
  query<T = any>(module: string, method: string, ...args: any[]): Promise<T>
}

export interface SubstrateApiContext {
  getHashers(module: string, method: string): Hashers | null
  hasPallet(name: string): boolean
  getTypeIdByPath(path: string | string[]): number | undefined
  decodeExtrinsic(hextBytes: string): Extrinsic
  storageCodec<T = any>(module: string, method: string): StorageCodec<T>
  typeCodec<T = any>(path: string | string[] | number): Codec<T>
  getConstant(palletName: string, name: string): any

  readonly events: {
    key: string
    dec: Decoder<Array<SystemEvent>>
  }
}

export type Hashers = (
  | {
      tag: 'Blake2128'
      value: undefined
    }
  | {
      tag: 'Blake2256'
      value: undefined
    }
  | {
      tag: 'Blake2128Concat'
      value: undefined
    }
  | {
      tag: 'Twox128'
      value: undefined
    }
  | {
      tag: 'Twox256'
      value: undefined
    }
  | {
      tag: 'Twox64Concat'
      value: undefined
    }
  | {
      tag: 'Identity'
      value: undefined
    }
)[]

export type { SubstrateNetworkInfo } from './ingress/types.js'
