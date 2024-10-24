import { Observable } from 'rxjs'

export type { Decoder, Codec } from '@polkadot-api/substrate-bindings'
export type { BlockInfo, SystemEvent } from '@polkadot-api/observable-client'
export type { ChainSpecData } from '@polkadot-api/substrate-client'

import type { HexString } from '@/lib.js'
import type { BlockInfo, SystemEvent } from '@polkadot-api/observable-client'
import type { Codec, Decoder } from '@polkadot-api/substrate-bindings'
import type { ChainSpecData } from '@polkadot-api/substrate-client'
import type { Block, Extrinsic, StorageCodec } from '../types.js'

export interface ApiClient {
  readonly chainId: string
  readonly isReady: () => Promise<ApiClient>
  readonly getChainSpecData: () => Promise<ChainSpecData>
  readonly finalizedHeads$: Observable<BlockInfo>
  readonly ctx: ApiContext

  connect(): Promise<ApiClient>
  disconnect(): void

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

export interface ApiContext {
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
