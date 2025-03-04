import { Observable } from 'rxjs'

import { IngressConsumer } from '@/services/ingress/consumer/types.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'
import { Block, SubstrateApiContext } from '../types.js'

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
  ss58Prefix?: number
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
  getStorage(chainId: NetworkURN, storageKey: HexString, blockHash?: HexString): Observable<HexString>
  getStorageKeys(
    chainId: NetworkURN,
    keyPrefix: HexString,
    count: number,
    startKey?: HexString,
    blockHash?: HexString,
  ): Observable<HexString[]>
  getContext(chainId: NetworkURN): Observable<SubstrateApiContext>
  getNetworkInfo(chainId: NetworkURN): Promise<SubstrateNetworkInfo>
  getRelayIds(): NetworkURN[]
  isRelay(chainId: NetworkURN): boolean
}
