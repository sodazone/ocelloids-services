export type { SystemEvent } from '@polkadot-api/observable-client'
export type { Codec, Decoder } from '@polkadot-api/substrate-bindings'
export type { ChainSpecData } from '@polkadot-api/substrate-client'

import type { SystemEvent } from '@polkadot-api/observable-client'
import type { Codec, Decoder } from '@polkadot-api/substrate-bindings'
import type { ChainSpecData } from '@polkadot-api/substrate-client'
import type { BlockInfo as PapiBlockInfo } from 'polkadot-api'

import type { HexString } from '@/lib.js'

import { ApiClient, BlockStatus } from '../types.js'
import { RpcApi } from './rpc.js'

export type StorageCodec<T = any> = {
  keys: {
    enc: (...args: any[]) => string
    dec: (value: string) => any[]
  }
  value: Codec<T>
}

export type StorageChangeSet = {
  block: string
  changes: [string, string | null][]
}

export type StorageChangeSets = StorageChangeSet[]

export type Event = {
  module: string
  name: string
  value: Record<string, any>
}

export type EventRecord<T = Event> = Omit<SystemEvent, 'event'> & {
  event: T
}

export type Call = {
  module: string
  method: string
  args: Record<string, any>
}

export type Extrinsic = Call & {
  hash: string
  signed: boolean
  signature: any
  address: any
  evmTxHash?: string
}

export type Block = {
  hash: string
  number: number
  parent: string
  extrinsics: Extrinsic[]
  events: EventRecord[]
  stateRoot: string
  extrinsicsRoot: string
  specVersion?: number
  digest?: {
    logs: any[]
  }
  status?: BlockStatus
}

export type BlockInfo = Omit<PapiBlockInfo, 'hasNewRuntime'>

export type BlockInfoWithStatus = BlockInfo & {
  status: BlockStatus
}

export type BlockContext = {
  blockNumber: number
  blockHash: string
  blockPosition: number
  specVersion?: number
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

export type BackedCandidate = {
  candidate: {
    descriptor: {
      core_index: number
      erasure_root: string
      para_head: string
      para_id: number
      persisted_validation_data_hash: string
      pov_hash: string
      relay_parent: string
      reserved1: string
      reserved2: string
      session_index: number
      validation_code_hash: string
      version: number
    }
    commitments: {
      head_data: string
      horizontal_messages:
        | {
            data: string
            recipient: number
          }[]
        | null
      hrmp_watermark: number
      new_validation_code: string | null
      processed_downward_messages: number
      upward_messages: string[] | null
    }
  }
  validator_indices: string
  validity_votes: {
    Explicit?: string
    Implicit?: string
  }[]
}

export interface SubstrateApi extends ApiClient {
  readonly isReady: () => Promise<SubstrateApi>
  readonly getChainSpecData: () => Promise<ChainSpecData>

  rpc: RpcApi
  ctx(specVersion?: number): Promise<SubstrateApiContext>
  getMetadata(): Promise<Uint8Array>
  getRuntimeVersion(): Promise<{
    specName: string
    implName: string
    authoringVersion: number
    specVersion: number
    implVersion: number
  }>

  getBlock(hash: string, isFollowing?: boolean): Promise<Block>
  getBlockHeader(hash: string): Promise<BlockInfo>

  getStorageKeys(
    keyPrefix: string,
    count: number,
    resolvedStartKey?: string,
    at?: string,
  ): Promise<HexString[]>

  getStorage(key: string, at?: string): Promise<HexString>
  queryStorageAt(keys: string[], at?: string): Promise<StorageChangeSets>
  query<T = any>(ops: { module: string; method: string; at?: string }, ...args: any[]): Promise<T | null>
  queryByPrefixPaginated<T = any>(
    { module, method, pageSize, at }: { module: string; method: string; pageSize?: number; at?: string },
    ...args: any[]
  ): AsyncGenerator<{ keyArgs: any[]; value: T }, void, void>

  runtimeCall<T = any>(opts: { api: string; method: string; at?: string }, ...args: any[]): Promise<T | null>
}

export interface SubstrateApiContext {
  getHashers(module: string, method: string): Hashers | null
  hasPallet(name: string): boolean
  getTypeIdByPath(path: string | string[]): number | undefined
  decodeCall(callData: string | Uint8Array): Call
  decodeExtrinsic(hextBytes: string): Extrinsic
  storageCodec<T = any>(module: string, method: string): StorageCodec<T>
  runtimeCallCodec<T = any>(
    api: string,
    method: string,
  ): {
    args: Codec<any[]>
    value: Codec<T>
  }
  typeCodec<T = any>(path: string | string[] | number): Codec<T>
  getConstant(palletName: string, name: string): any

  readonly events: {
    key: string
    dec: Decoder<Array<SystemEvent>>
  }
}

export type Hasher =
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

export type Hashers = Hasher[]

export type { SubstrateNetworkInfo } from './ingress/types.js'
