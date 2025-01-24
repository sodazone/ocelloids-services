import { EventEmitter } from 'node:events'
import { ServiceConfiguration } from '@/services/config.js'
import { Watcher } from '@/services/networking/watcher.js'
import { TelemetryCollect, TelemetryEventEmitter } from '@/services/telemetry/types.js'
import { Logger, NetworkURN, Services } from '@/services/types.js'

import { Observable } from 'rxjs'
import { IngressConsumer } from './types.js'

export abstract class LocalIngressConsumer<T extends Watcher, B, C>
  extends (EventEmitter as new () => TelemetryEventEmitter)
  implements IngressConsumer
{
  protected readonly log: Logger
  protected readonly config: ServiceConfiguration
  protected readonly watcher: T

  constructor(ctx: Services, watcher: T) {
    super()

    this.log = ctx.log
    this.config = ctx.localConfig
    this.watcher = watcher
  }

  getNetworkInfo(chainId: NetworkURN): Promise<C> {
    return this.watcher.getNetworkInfo(chainId) as Promise<C>
  }

  isNetworkDefined(chainId: NetworkURN): boolean {
    return this.config.isNetworkDefined(chainId)
  }

  getChainIds(): NetworkURN[] {
    return this.watcher.chainIds
  }

  collectTelemetry(collect: TelemetryCollect): void {
    collect(this)
    collect(this.watcher)
  }

  finalizedBlocks(chainId: NetworkURN): Observable<B> {
    return this.watcher.finalizedBlocks(chainId) as Observable<B>
  }

  async start() {
    this.watcher.start()
  }

  async stop() {
    this.watcher.stop()
  }
}
