import EventEmitter from 'node:events'
import { Observable } from 'rxjs'

import { NetworkURN } from '@/lib.js'
import { ServiceConfiguration, isNetworkDefined } from '@/services/config.js'
import { Services } from '@/services/index.js'
import { TelemetryCollect, TelemetryEventEmitter } from '@/services/telemetry/types.js'

import { Block, ChainInfo } from '../types.js'
import { BitcoinIngressConsumer } from './types.js'
import { BitcoinWatcher } from './watcher.js'

export class BitcoinLocalConsumer
  extends (EventEmitter as new () => TelemetryEventEmitter)
  implements BitcoinIngressConsumer
{
  // readonly #log: Logger;
  readonly #config: ServiceConfiguration
  readonly #watcher: BitcoinWatcher

  constructor(ctx: Services) {
    super()

    // this.#log = ctx.log;
    this.#config = ctx.localConfig
    this.#watcher = new BitcoinWatcher(ctx)
  }

  getChainInfo(chainId: NetworkURN): Promise<ChainInfo> {
    return this.#watcher.getChainInfo(chainId)
  }

  isNetworkDefined(chainId: NetworkURN): boolean {
    return isNetworkDefined(this.#config, chainId)
  }

  getChainIds(): NetworkURN[] {
    return this.#watcher.chainIds
  }

  collectTelemetry(collect: TelemetryCollect): void {
    collect(this)
  }

  finalizedBlocks(chainId: NetworkURN): Observable<Block> {
    return this.#watcher.finalizedBlocks(chainId)
  }

  async start() {
    //
  }

  async stop() {
    //
  }
}
