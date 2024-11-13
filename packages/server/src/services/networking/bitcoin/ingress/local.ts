import EventEmitter from 'node:events'
import { Observable } from 'rxjs'

import { NetworkURN } from '@/lib.js'
import { ServiceConfiguration, isNetworkDefined } from '@/services/config.js'
import { Services } from '@/services/index.js'
import { TelemetryCollect, TelemetryEventEmitter } from '@/services/telemetry/types.js'

import { BitcoinApi } from '../client.js'
import { Block, ChainInfo } from '../types.js'
import { BitcoinIngressConsumer } from './types.js'

export class BitcoinLocalConsumer
  extends (EventEmitter as new () => TelemetryEventEmitter)
  implements BitcoinIngressConsumer
{
  // readonly #log: Logger;
  readonly #apis: Record<string, BitcoinApi>
  readonly #config: ServiceConfiguration

  constructor(ctx: Services) {
    super()

    // this.#log = ctx.log;
    this.#config = ctx.localConfig
    this.#apis = ctx.connector.connect<BitcoinApi>('bitcoin')
  }
  getChainInfo(chainId: NetworkURN): Promise<ChainInfo> {
    return this.#apis[chainId].getChainInfo()
  }

  isNetworkDefined(chainId: NetworkURN): boolean {
    return isNetworkDefined(this.#config, chainId)
  }

  getChainIds(): NetworkURN[] {
    return Object.keys(this.#apis) as NetworkURN[]
  }

  collectTelemetry(collect: TelemetryCollect): void {
    collect(this)
  }

  finalizedBlocks(chainId: NetworkURN): Observable<Block> {
    return this.#apis[chainId].follow$
  }

  async start() {
    //
  }

  async stop() {
    //
  }
}
