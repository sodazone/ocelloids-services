import { Observable } from 'rxjs'

import { IngressConsumer } from '@/services/ingress/consumer/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import { Block, StorageChangeSets, SubstrateApiContext } from '../types.js'

/**
 * Extended Network Information for Substrate Networks.
 *
 * @public
 */
export type SubstrateNetworkInfo = {
  urn: NetworkURN
  genesisHash: HexString
  chainTokens: string[]
  chainDecimals: number[]
  runtimeChain: string
  existentialDeposit?: string
  ss58Prefix?: number | null
  parachainId?: string
}

/**
 * Interface defining the operations for an IngressConsumer.
 *
 * This interface provides a contract for components functioning both locally
 * and in a distributed environment.
 */
export interface SubstrateIngressConsumer extends IngressConsumer {
  finalizedBlocks(chainId: NetworkURN): Observable<Block>
  newBlocks(chainId: NetworkURN): Observable<Block>
  getStorage(chainId: NetworkURN, storageKey: HexString, blockHash?: HexString): Observable<HexString>
  getStorageKeys(
    chainId: NetworkURN,
    keyPrefix: HexString,
    count: number,
    startKey?: HexString,
    blockHash?: HexString,
  ): Observable<HexString[]>
  getContext(chainId: NetworkURN, specVersion?: number): Observable<SubstrateApiContext>
  getNetworkInfo(chainId: NetworkURN): Promise<SubstrateNetworkInfo>
  getRelayIds(): NetworkURN[]
  queryStorageAt(
    chainId: NetworkURN,
    storageKeys: HexString[],
    blockHash?: HexString,
  ): Observable<StorageChangeSets>
  runtimeCall<T = any>(
    chainId: NetworkURN,
    opts: { api: string; method: string; at?: string },
    ...args: any[]
  ): Promise<T | null>
  query<T = any>(
    chainId: NetworkURN,
    ops: {
      module: string
      method: string
      at?: HexString
    },
    ...params: any[]
  ): Promise<T | null>
  isRelay(chainId: NetworkURN): boolean
  isReady(): Promise<void>
  __getBlock(chainId: NetworkURN, hash: string): Promise<Block>
}
