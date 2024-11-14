import { EventEmitter } from 'node:events'

import { Observable, from, map, shareReplay } from 'rxjs'

import { NetworkURN, Services } from '@/services/types.js'

import { ServiceConfiguration, isNetworkDefined, isRelay } from '@/services/config.js'
import { HexString } from '@/services/subscriptions/types.js'
import { TelemetryCollect, TelemetryEventEmitter } from '@/services/telemetry/types.js'
import { Block, SubstrateApiContext } from '../../types.js'
import { SubstrateWatcher } from '../../watcher/watcher.js'
import { NetworkInfo, SubstrateIngressConsumer } from '../types.js'

/**
 * Represents an implementation of {@link SubstrateIngressConsumer} that operates in a local environment
 * with direct connectivity to blockchain networks.
 *
 * This class is responsible for managing block consumption and storage retrieval logic
 * within a local or integrated environment.
 */
export class SubstrateLocalConsumer
  extends (EventEmitter as new () => TelemetryEventEmitter)
  implements SubstrateIngressConsumer
{
  // readonly #log: Logger;
  readonly #headCatcher: SubstrateWatcher
  readonly #config: ServiceConfiguration
  readonly #contexts$: Record<NetworkURN, Observable<SubstrateApiContext>>

  constructor(ctx: Services) {
    super()

    // this.#log = ctx.log;
    this.#config = ctx.localConfig
    this.#headCatcher = new SubstrateWatcher(ctx)
    this.#contexts$ = {}
  }

  async start() {
    this.#headCatcher.start()
  }

  async stop() {
    this.#headCatcher.stop()
  }

  getChainIds(): NetworkURN[] {
    return this.#headCatcher.chainIds
  }

  getRelayIds(): NetworkURN[] {
    return this.#config.networks.filter((n) => n.relay === undefined).map((n) => n.id) as NetworkURN[]
  }

  isRelay(chainId: NetworkURN) {
    return isRelay(this.#config, chainId)
  }

  isNetworkDefined(chainId: NetworkURN) {
    return isNetworkDefined(this.#config, chainId)
  }

  async getChainInfo(chainId: NetworkURN): Promise<NetworkInfo> {
    return await this.#headCatcher.getNetworkInfo(chainId)
  }

  finalizedBlocks(chainId: NetworkURN): Observable<Block> {
    return this.#headCatcher.finalizedBlocks(chainId)
  }

  getContext(chainId: NetworkURN): Observable<SubstrateApiContext> {
    if (this.#contexts$[chainId] === undefined) {
      this.#contexts$[chainId] = from(this.#headCatcher.getApi(chainId)).pipe(
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
    return this.#headCatcher.getStorage(chainId, storageKey, blockHash)
  }

  getStorageKeys(
    chainId: NetworkURN,
    keyPrefix: HexString,
    count: number,
    startKey?: HexString,
    blockHash?: HexString,
  ): Observable<HexString[]> {
    return this.#headCatcher.getStorageKeys(chainId, keyPrefix, count, startKey, blockHash)
  }

  collectTelemetry(collect: TelemetryCollect): void {
    collect(this)
    collect(this.#headCatcher)
  }
}
