/* istanbul ignore file */
import EventEmitter from 'node:events'

import { Subscription as RxSubscription } from 'rxjs'

import { ServiceConfiguration } from '@/services/config.js'
import { Watcher } from '@/services/networking/watcher.js'
import { TelemetryCollect, TelemetryEventEmitter } from '@/services/telemetry/types.js'
import { Logger, NetworkURN, Services } from '@/services/types.js'
import { IngressOptions } from '@/types.js'

import { NetworkEntry, NetworksKey, RedisDistributor, XAddOptions } from '../../ingress/distributor.js'
import { IngressProducer } from './types.js'

/**
 * BaseIngressProducer is responsible for managing the ingress process, including:
 * - Publishing blocks into Redis streams
 * - Writing network configuration into a Redis set
 */
export default abstract class BaseIngressProducer<T extends Watcher<unknown>>
  extends (EventEmitter as new () => TelemetryEventEmitter)
  implements IngressProducer
{
  protected readonly log: Logger
  protected readonly watcher: T
  protected readonly distributor: RedisDistributor
  protected readonly streamOptions: XAddOptions

  readonly #rxSubs: Record<string, RxSubscription> = {}
  readonly #config: ServiceConfiguration

  constructor(ctx: Services, watcher: T, opts: IngressOptions) {
    super()

    this.log = ctx.log
    this.watcher = watcher
    this.streamOptions = {
      TRIM: {
        strategy: 'MAXLEN',
        strategyModifier: '~',
        threshold: 1000,
      },
    }
    this.distributor = new RedisDistributor(opts, ctx)

    this.#config = ctx.localConfig
  }

  async start() {
    await this.distributor.start()

    this.watcher.start()

    await this.#writeNetworkConfig()

    // don't wait
    this.#initializeStreams()
  }

  async stop() {
    this.log.info('Stopping ingress producer')

    for (const [chainId, rxSub] of Object.entries(this.#rxSubs)) {
      this.log.info('[%s] RX Unsubscribe', chainId)

      rxSub.unsubscribe()
    }

    this.watcher.stop()

    await this.distributor.stop()
  }

  collectTelemetry(collect: TelemetryCollect) {
    collect(this.watcher)
    collect(this)
  }

  abstract createBlockStream(chainId: NetworkURN): RxSubscription
  abstract beforeCreateStream(chainId: NetworkURN): Promise<void>

  async #initializeStreams() {
    const chainIds = this.watcher.chainIds

    for (const chainId of chainIds) {
      this.beforeCreateStream(chainId)
      this.#rxSubs[chainId] = this.createBlockStream(chainId)
    }
  }

  async #writeNetworkConfig() {
    // TODO handle DELETE
    const networks: NetworkEntry[] = []
    for (const network of this.#config.networks) {
      const chainId = network.id as NetworkURN
      const info = await this.watcher.getNetworkInfo(chainId)

      networks.push({
        id: chainId,
        isRelay: network.relay === undefined,
        info,
      })

      this.log.info('[%s] WRITE network configuration (relay=%s)', chainId, network.relay ?? 'n/a')
    }
    await this.distributor.sadd(
      NetworksKey,
      networks.map((network) => JSON.stringify(network)),
    )
  }
}
