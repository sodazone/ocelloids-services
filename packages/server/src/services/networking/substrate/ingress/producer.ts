/* istanbul ignore file */
import EventEmitter from 'node:events'

import { Subscription as RxSubscription } from 'rxjs'

import { ServiceConfiguration } from '@/services/config.js'
import { HexString } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN, Services } from '@/services/types.js'
import { IngressOptions } from '@/types.js'
import {
  NetworkEntry,
  NetworksKey,
  RedisDistributor,
  XAddOptions,
  getBlockStreamKey,
  getMetadataKey,
  getStorageKeysReqKey,
  getStorageReqKey,
  getVersionKey,
} from '../../../ingress/distributor.js'
import { HeadCatcher } from '../watcher/head-catcher.js'

import { TelemetryCollect, TelemetryEventEmitter } from '@/services/telemetry/types.js'
import { encodeBlock } from '../watcher/codec.js'

type StorageRequest = {
  replyTo: string
  storageKey: HexString
  at: HexString
}

type StorageKeysRequest = {
  replyTo: string
  keyPrefix: HexString
  startKey?: HexString
  count: number
  at: HexString
}

/**
 * IngressProducer is responsible for managing the ingress process, including:
 * - Publishing blocks into Redis streams
 * - Publishing runtime metadata into Redis streams
 * - Providing blockchain storage data through asynchronous request-reply
 * - Writing network configuration into a Redis set
 */
export default class IngressProducer extends (EventEmitter as new () => TelemetryEventEmitter) {
  readonly #log: Logger
  readonly #headCatcher: HeadCatcher
  readonly #distributor: RedisDistributor
  readonly #rxSubs: Record<string, RxSubscription> = {}
  readonly #streamOptions: XAddOptions

  readonly #config: ServiceConfiguration

  constructor(ctx: Services, opts: IngressOptions) {
    super()

    this.#log = ctx.log

    this.#headCatcher = new HeadCatcher(ctx)
    this.#config = ctx.localConfig
    this.#streamOptions = {
      TRIM: {
        strategy: 'MAXLEN',
        strategyModifier: '~',
        threshold: 1000,
      },
    }
    this.#distributor = new RedisDistributor(opts, ctx)
  }

  async start() {
    await this.#distributor.start()

    this.#headCatcher.start()

    await this.#writeNetworkConfig()

    // don't wait
    this.#initializeStreams()
  }

  async stop() {
    this.#log.info('Stopping ingress producer')

    for (const [chainId, rxSub] of Object.entries(this.#rxSubs)) {
      this.#log.info('[%s] RX Unsubscribe', chainId)

      rxSub.unsubscribe()
    }

    this.#headCatcher.stop()

    await this.#distributor.stop()
  }

  collectTelemetry(collect: TelemetryCollect) {
    collect(this.#headCatcher)
    collect(this)
  }

  async #initializeStreams() {
    const chainIds = this.#headCatcher.chainIds

    for (const chainId of chainIds) {
      const key = getBlockStreamKey(chainId)

      this.#log.info('[%s] Block Stream [key=%s]', chainId, key)

      // TODO implement using RX + retry
      const api = await this.#headCatcher.getApi(chainId)
      const versionKey = getVersionKey(chainId)
      const runtimeVersion = await this.#distributor.get(versionKey)

      const chainRuntimeVersion = await api.getRuntimeVersion()
      const chainSpecVersion = chainRuntimeVersion.specVersion.toString()

      this.#log.info(
        '[%s] Runtime version %s [current=%s]',
        chainId,
        runtimeVersion ?? 'unknown',
        chainSpecVersion,
      )

      if (chainSpecVersion !== runtimeVersion) {
        this.#log.info('[%s] GET metadata', chainId)

        const metadata = await api.getMetadata()
        const metadataKey = getMetadataKey(chainId)

        this.#log.info('[%s] UPDATE metadata [key=%s,spec=%s]', chainId, metadataKey, chainSpecVersion)
        await this.#distributor.mset([metadataKey, Buffer.from(metadata)], [versionKey, chainSpecVersion])
      }

      this.#rxSubs[chainId] = this.#headCatcher.finalizedBlocks(chainId).subscribe({
        next: (block) => {
          this.#distributor.addBytes(key, encodeBlock(block), this.#streamOptions)
        },
      })

      this.#registerStorageRequestHandler(chainId)
      this.#registerStorageKeysRequestHandler(chainId)
    }
  }

  async #writeNetworkConfig() {
    // TODO handle DELETE
    const networks: NetworkEntry[] = []
    for (const network of this.#config.networks) {
      const chainId = network.id as NetworkURN
      const info = await this.#headCatcher.fetchNetworkInfo(chainId)

      networks.push({
        id: chainId,
        isRelay: network.relay === undefined,
        info,
      })

      this.#log.info('[%s] WRITE network configuration (relay=%s)', chainId, network.relay ?? 'n/a')
    }
    await this.#distributor.sadd(
      NetworksKey,
      networks.map((network) => JSON.stringify(network)),
    )
  }

  #registerStorageKeysRequestHandler(chainId: NetworkURN) {
    const key = getStorageKeysReqKey(chainId)
    this.#distributor.read<StorageKeysRequest>(key, (request, { client }) => {
      this.#headCatcher
        .getStorageKeys(chainId, request.keyPrefix, request.count, request.startKey, request.at)
        .subscribe({
          next: (data) => {
            client.LPUSH(request.replyTo, Buffer.from(JSON.stringify(data)))
          },
          error: (e) => {
            this.#log.error(e, '[%s] error reading storage keys (keyPrefix=%s)', chainId, request.keyPrefix)
          },
        })
    })
  }

  #registerStorageRequestHandler(chainId: NetworkURN) {
    const key = getStorageReqKey(chainId)
    this.#distributor.read<StorageRequest>(key, (request, { client }) => {
      this.#headCatcher.getStorage(chainId, request.storageKey, request.at).subscribe({
        next: (data) => {
          client.LPUSH(request.replyTo, Buffer.from(data.slice(2), 'hex'))
        },
        error: (e) => {
          this.#log.error(e, '[%s] error reading storage (key=%s)', chainId, request.storageKey)
        },
      })
    })
  }
}
