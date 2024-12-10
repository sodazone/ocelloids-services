import { Observable, from, map, shareReplay } from 'rxjs'

import { LocalIngressConsumer } from '@/services/ingress/consumer/base.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN, Services } from '@/services/types.js'

import { Block, SubstrateApiContext } from '../../types.js'
import { SubstrateWatcher } from '../../watcher/watcher.js'
import { SubstrateNetworkInfo, SubstrateIngressConsumer } from '../types.js'

/**
 * Represents an implementation of {@link SubstrateIngressConsumer} that operates in a local environment
 * with direct connectivity to blockchain networks.
 *
 * This class is responsible for managing block consumption and storage retrieval logic
 * within a local or integrated environment.
 */
export class SubstrateLocalConsumer
  extends LocalIngressConsumer<SubstrateWatcher, Block, SubstrateNetworkInfo>
  implements SubstrateIngressConsumer
{
  readonly #contexts$: Record<NetworkURN, Observable<SubstrateApiContext>>

  constructor(ctx: Services) {
    super(ctx, new SubstrateWatcher(ctx))

    this.#contexts$ = {}
  }

  getRelayIds(): NetworkURN[] {
    return this.config.substrate.filter((n) => n.relay === undefined).map((n) => n.id) as NetworkURN[]
  }

  isRelay(chainId: NetworkURN) {
    return this.config.isRelay(chainId)
  }

  getContext(chainId: NetworkURN): Observable<SubstrateApiContext> {
    if (this.#contexts$[chainId] === undefined) {
      this.#contexts$[chainId] = from(this.watcher.getApi(chainId)).pipe(
        map((api) => api.ctx),
        // TODO retry
        shareReplay({
          refCount: true,
        }),
      )
    }
    return this.#contexts$[chainId]
  }

  getStorage(chainId: NetworkURN, storageKey: HexString, blockHash?: HexString): Observable<HexString> {
    return this.watcher.getStorage(chainId, storageKey, blockHash)
  }

  getStorageKeys(
    chainId: NetworkURN,
    keyPrefix: HexString,
    count: number,
    startKey?: HexString,
    blockHash?: HexString,
  ): Observable<HexString[]> {
    return this.watcher.getStorageKeys(chainId, keyPrefix, count, startKey, blockHash)
  }
}
