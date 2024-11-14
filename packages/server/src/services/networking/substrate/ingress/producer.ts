/* istanbul ignore file */
import { Subscription as RxSubscription } from 'rxjs'

import BaseIngressProducer from '@/services/ingress/producer/base.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN, Services } from '@/services/types.js'
import { IngressOptions } from '@/types.js'

import {
  getBlockStreamKey,
  getMetadataKey,
  getStorageKeysReqKey,
  getStorageReqKey,
  getVersionKey,
} from '../../../ingress/distributor.js'
import { encodeBlock } from '../watcher/codec.js'
import { SubstrateWatcher } from '../watcher/watcher.js'

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
 * SubstrateProducer is responsible for managing the ingress process, including:
 * - Publishing blocks into Redis streams
 * - Publishing runtime metadata into Redis streams
 * - Providing blockchain storage data through asynchronous request-reply
 * - Writing network configuration into a Redis set
 */
export default class SubstrateProducer extends BaseIngressProducer<SubstrateWatcher> {
  createBlockStream(chainId: NetworkURN): RxSubscription {
    const key = getBlockStreamKey(chainId)

    this.log.info('[%s] Block Stream [key=%s]', chainId, key)

    return this.watcher.finalizedBlocks(chainId).subscribe({
      next: (block) => {
        this.distributor.addBytes(key, encodeBlock(block), this.streamOptions)
      },
    })
  }
  async beforeCreateStream(chainId: NetworkURN) {
    // TODO implement using RX + retry
    const api = await this.watcher.getApi(chainId)
    const versionKey = getVersionKey(chainId)
    const runtimeVersion = await this.distributor.get(versionKey)

    const chainRuntimeVersion = await api.getRuntimeVersion()
    const chainSpecVersion = chainRuntimeVersion.specVersion.toString()

    this.log.info(
      '[%s] Runtime version %s [current=%s]',
      chainId,
      runtimeVersion ?? 'unknown',
      chainSpecVersion,
    )

    if (chainSpecVersion !== runtimeVersion) {
      this.log.info('[%s] GET metadata', chainId)

      const metadata = await api.getMetadata()
      const metadataKey = getMetadataKey(chainId)

      this.log.info('[%s] UPDATE metadata [key=%s,spec=%s]', chainId, metadataKey, chainSpecVersion)
      await this.distributor.mset([metadataKey, Buffer.from(metadata)], [versionKey, chainSpecVersion])
    }

    this.#registerStorageRequestHandler(chainId)
    this.#registerStorageKeysRequestHandler(chainId)
  }
  constructor(ctx: Services, opts: IngressOptions) {
    super(ctx, new SubstrateWatcher(ctx), opts)
  }

  #registerStorageKeysRequestHandler(chainId: NetworkURN) {
    const key = getStorageKeysReqKey(chainId)
    this.distributor.read<StorageKeysRequest>(key, (request, { client }) => {
      this.watcher
        .getStorageKeys(chainId, request.keyPrefix, request.count, request.startKey, request.at)
        .subscribe({
          next: (data) => {
            client.LPUSH(request.replyTo, Buffer.from(JSON.stringify(data)))
          },
          error: (e) => {
            this.log.error(e, '[%s] error reading storage keys (keyPrefix=%s)', chainId, request.keyPrefix)
          },
        })
    })
  }

  #registerStorageRequestHandler(chainId: NetworkURN) {
    const key = getStorageReqKey(chainId)
    this.distributor.read<StorageRequest>(key, (request, { client }) => {
      this.watcher.getStorage(chainId, request.storageKey, request.at).subscribe({
        next: (data) => {
          client.LPUSH(request.replyTo, Buffer.from(data.slice(2), 'hex'))
        },
        error: (e) => {
          this.log.error(e, '[%s] error reading storage (key=%s)', chainId, request.storageKey)
        },
      })
    })
  }
}
