import { EventEmitter } from 'node:events'

import { Observable, map, of, shareReplay } from 'rxjs'

import { NetworkURN, Services } from '@/services/types.js'

import { ServiceConfiguration, isNetworkDefined, isRelay } from '@/services/config.js'
import { Block, RuntimeContext } from '@/services/networking/client.js'
import { HexString } from '@/services/subscriptions/types.js'
import { TelemetryCollect, TelemetryEventEmitter } from '@/services/telemetry/types.js'
import { HeadCatcher } from '../watcher/head-catcher.js'
import { IngressConsumer, NetworkInfo } from './index.js'

/**
 * Represents an implementation of {@link IngressConsumer} that operates in a local environment
 * with direct connectivity to blockchain networks.
 *
 * This class is responsible for managing block consumption and storage retrieval logic
 * within a local or integrated environment.
 */
export class LocalIngressConsumer
  extends (EventEmitter as new () => TelemetryEventEmitter)
  implements IngressConsumer
{
  // readonly #log: Logger;
  readonly #headCatcher: HeadCatcher
  readonly #config: ServiceConfiguration
  readonly #registries$: Record<NetworkURN, Observable<RuntimeContext>>

  constructor(ctx: Services) {
    super()

    // this.#log = ctx.log;
    this.#config = ctx.localConfig
    this.#headCatcher = new HeadCatcher(ctx)
    this.#registries$ = {}
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
    return await this.#headCatcher.fetchNetworkInfo(chainId)
  }

  finalizedBlocks(chainId: NetworkURN): Observable<Block> {
    return this.#headCatcher.finalizedBlocks(chainId)
  }

  getRegistry(chainId: NetworkURN): Observable<RuntimeContext> {
    if (this.#registries$[chainId] === undefined) {
      this.#registries$[chainId] = of(this.#headCatcher.getApi(chainId)).pipe(
        map((api) => api.ctx),
        // TODO retry
        shareReplay({
          refCount: true,
        }),
      )
    }
    return this.#registries$[chainId]
  }

  getStorage(chainId: NetworkURN, storageKey: HexString, blockHash?: HexString): Observable<Uint8Array> {
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
