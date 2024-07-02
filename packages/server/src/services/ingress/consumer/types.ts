import { Observable } from 'rxjs'

import type { SignedBlockExtended } from '@polkadot/api-derive/types'
import type { Registry } from '@polkadot/types-codec/types'
import { ChainProperties } from '@polkadot/types/interfaces'

import { NetworkURN } from '../../types.js'

import { HexString } from '../../subscriptions/types.js'
import { TelemetryCollect, TelemetryEventEmitter } from '../../telemetry/types.js'

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
  getChainProperties(chainId: NetworkURN): Promise<ChainProperties>
  getRelayIds(): NetworkURN[]
  isRelay(chainId: NetworkURN): boolean
  isNetworkDefined(chainId: NetworkURN): boolean
  getChainIds(): NetworkURN[]
  start(): Promise<void>
  stop(): Promise<void>
  collectTelemetry(collect: TelemetryCollect): void
}
