import { Observable } from 'rxjs'

import type { SignedBlockExtended } from '@polkadot/api-derive/types'
import type { Registry } from '@polkadot/types-codec/types'

import { NetworkURN } from '@/services/types.js'

import { HexString } from '@/services/subscriptions/types.js'
import { TelemetryCollect, TelemetryEventEmitter } from '@/services/telemetry/types.js'

/**
 * Extended Network Information
 */
export type NetworkInfo = {
  urn: NetworkURN
  genesisHash: HexString
  chainTokens: string[]
  chainDecimals: number[]
  runtimeChain: string
  blockTime: number // in milliseconds
  existentialDeposit?: string
  ss58Prefix?: number
  parachainId?: string
}

/**
 * Interface defining the operations for an IngressConsumer.
 *
 * This interface provides a contract for components functioning both locally
 * and in a distributed environment.
 */
export interface IngressConsumer extends TelemetryEventEmitter {
  finalizedBlocks(chainId: NetworkURN): Observable<SignedBlockExtended>
  getStorage(chainId: NetworkURN, storageKey: HexString, blockHash?: HexString): Observable<Uint8Array>
  getStorageKeys(
    chainId: NetworkURN,
    keyPrefix: HexString,
    count: number,
    startKey?: HexString,
    blockHash?: HexString,
  ): Observable<HexString[]>
  getRegistry(chainId: NetworkURN): Observable<Registry>
  getChainInfo(chainId: NetworkURN): Promise<NetworkInfo>
  getRelayIds(): NetworkURN[]
  isRelay(chainId: NetworkURN): boolean
  isNetworkDefined(chainId: NetworkURN): boolean
  getChainIds(): NetworkURN[]
  start(): Promise<void>
  stop(): Promise<void>
  collectTelemetry(collect: TelemetryCollect): void
}
