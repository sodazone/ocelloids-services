export type { Decoder, Codec } from '@polkadot-api/substrate-bindings'
export type { BlockInfo, SystemEvent } from '@polkadot-api/observable-client'
export type { ChainSpecData } from '@polkadot-api/substrate-client'

import { Observable } from 'rxjs'

import type { BlockInfo, SystemEvent } from '@polkadot-api/observable-client'
import type { Codec, Decoder } from '@polkadot-api/substrate-bindings'
import type { ChainSpecData } from '@polkadot-api/substrate-client'

import type { HexString } from '@/lib.js'

import { ApiClient } from '../types.js'

export type StorageCodec<T = any> = {
  enc: (...args: any[]) => string
  dec: Decoder<T>
  keyDecoder: (value: string) => any[]
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
  module: string
  method: string
  signed: boolean
  signature: any
  address: any
  args: Record<string, any>
}

export type Block = {
  hash: string
  number: number
  parent: string
  extrinsics: Extrinsic[]
  events: EventRecord[]
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

export interface SubstrateApiClient extends ApiClient {
  readonly ctx: SubstrateApiContext
  readonly isReady: () => Promise<SubstrateApiClient>
  readonly getChainSpecData: () => Promise<ChainSpecData>
  readonly finalizedHeads$: Observable<BlockInfo>

  getMetadata(): Promise<Uint8Array>
  getRuntimeVersion(): Promise<{
    specName: string
    implName: string
    authoringVersion: number
    specVersion: number
    implVersion: number
  }>

  getBlock(hash: string): Promise<Block>
  getBlockHash(blockNumber: string): Promise<string>
  getHeader(hash: string): Promise<{ hash: string; number: number; parent: string }>
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
