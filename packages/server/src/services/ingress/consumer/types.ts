import { Observable } from 'rxjs'

import { ApiContext, Block } from '@/services/networking/index.js'
import { HexString } from '@/services/subscriptions/types.js'
import { TelemetryCollect, TelemetryEventEmitter } from '@/services/telemetry/types.js'
import { NetworkURN } from '@/services/types.js'

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
  finalizedBlocks(chainId: NetworkURN): Observable<Block>
  getStorage(chainId: NetworkURN, storageKey: HexString, blockHash?: HexString): Observable<HexString>
  getStorageKeys(
    chainId: NetworkURN,
    keyPrefix: HexString,
    count: number,
    startKey?: HexString,
    blockHash?: HexString,
  ): Observable<HexString[]>
  getContext(chainId: NetworkURN): Observable<ApiContext>
  getChainInfo(chainId: NetworkURN): Promise<NetworkInfo>
  getRelayIds(): NetworkURN[]
  isRelay(chainId: NetworkURN): boolean
  isNetworkDefined(chainId: NetworkURN): boolean
  getChainIds(): NetworkURN[]
  start(): Promise<void>
  stop(): Promise<void>
  collectTelemetry(collect: TelemetryCollect): void
}
