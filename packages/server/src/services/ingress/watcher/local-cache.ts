import { EventEmitter } from 'node:events'

import { SubstrateApis, blocks, retryWithTruncatedExpBackoff } from '@sodazone/ocelloids-sdk'

import { Subscription, from, map, mergeAll, mergeMap, switchMap, tap, zip } from 'rxjs'

import { ApiPromise, ApiRx } from '@polkadot/api'
import type { SignedBlockExtended } from '@polkadot/api-derive/types'
import type { Raw } from '@polkadot/types'
import type { Hash } from '@polkadot/types/interfaces'

import { parachainSystemHrmpOutboundMessages, parachainSystemUpwardMessages } from '../../agents/xcm/storage.js'
import { NetworkConfiguration } from '../../config.js'
import { Janitor } from '../../persistence/janitor.js'
import { HexString } from '../../subscriptions/types.js'
import { TelemetryEventEmitter } from '../../telemetry/types.js'
import { DB, Logger, NetworkURN, Services, prefixes } from '../../types.js'

import { decodeSignedBlockExtended, encodeSignedBlockExtended } from './codec.js'
import { RETRY_INFINITE } from './head-catcher.js'

/**
 * Storage keys to be cached.
 */
const captureStorageKeys: HexString[] = [parachainSystemHrmpOutboundMessages, parachainSystemUpwardMessages]

/**
 * A local cache for seen blocks and storage items.
 *
 * When using Smoldot as a parachain light client, it cannot retrieve finalized block content
 * after the finalized block height surpasses the "best" number from the initial handshake.
 * This occurs because the block announcements never contain the "best" flag. As a result, the mapping
 * of peers to the "best" block is never updated after the initial announcement handshake. Consequently,
 * the block content cannot be retrieved due to Smoldot's retrieval logic. See:
 * - https://github.com/smol-dot/smoldot/blob/6f7afdc9d35a1377af1073be6c0791a62a9c7f45/light-base/src/sync_service.rs#L507
 * - https://github.com/smol-dot/smoldot/blob/6f7afdc9d35a1377af1073be6c0791a62a9c7f45/light-base/src/json_rpc_service/background.rs#L713
 */
export class LocalCache extends (EventEmitter as new () => TelemetryEventEmitter) {
  readonly #log: Logger
  readonly #db: DB
  readonly #janitor: Janitor
  readonly #apis: SubstrateApis

  readonly #subs: Record<string, Subscription> = {}

  constructor(apis: SubstrateApis, { log, db: rootStore, janitor }: Services) {
    super()

    this.#log = log
    this.#apis = apis
    this.#janitor = janitor
    this.#db = rootStore
  }

  /**
   * Caches produced blocks and storage items.
   *
   * @param network - The network configuration
   */
  watch(network: NetworkConfiguration) {
    const chainId = network.id as NetworkURN
    const isRelayChain = network.relay === undefined
    const api = this.#apis.rx[chainId]

    this.#log.info('[%s] Register block cache', chainId)

    const block$ = api.pipe(
      blocks(),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
      tap(({ block: { header } }) => {
        this.#log.debug('[%s] SEEN block #%s %s', chainId, header.number.toString(), header.hash.toHex())

        this.emit('telemetryBlockSeen', {
          chainId,
          header,
        })
      })
    )

    const fromStorage = (_api: ApiRx, hash: Hash) =>
      zip(captureStorageKeys.map((key) => from(_api.rpc.state.getStorage<Raw>(key, hash)))).pipe(
        map((items) => {
          return items.map((value, index) => ({
            key: captureStorageKeys[index],
            value,
          }))
        })
      )

    const msgs$ = block$.pipe(
      mergeMap((block) => {
        return api.pipe(
          switchMap((_api) => fromStorage(_api, block.block.header.hash)),
          this.#tapError(chainId, `captureStorage(${captureStorageKeys.join(',')})`),
          retryWithTruncatedExpBackoff(RETRY_INFINITE),
          map((storageItems) => {
            return {
              block,
              storageItems,
            }
          })
        )
      })
    )

    if (isRelayChain) {
      this.#subs[chainId] = block$
        .pipe(
          map((block) => from(this.#putBlockBuffer(chainId, block))),
          mergeAll()
        )
        .subscribe({
          error: (error) => this.#log.error(error, '[%s] Error on caching block for relay chain', chainId),
        })
    } else {
      this.#subs[chainId] = msgs$
        .pipe(
          map(({ block, storageItems }) => {
            const ops = [from(this.#putBlockBuffer(chainId, block))]
            const hash = block.block.header.hash.toHex()

            for (const storageItem of storageItems) {
              ops.push(
                from(
                  this.#putBuffer(
                    chainId,
                    prefixes.cache.keys.storage(storageItem.key, hash),
                    storageItem.value.toU8a(true)
                  )
                )
              )
            }

            return ops
          }),
          mergeAll()
        )
        .subscribe({
          error: (error: unknown) => {
            this.#log.error(error, '[%s] Error on caching block and XCMP messages for parachain', chainId)
          },
        })
    }
  }

  /**
   * Gets a persisted extended signed block from the storage or
   * tries to get it from the network if not found.
   */
  async getBlock(chainId: NetworkURN, api: ApiPromise, hash: HexString) {
    try {
      const buffer = await this.#bufferCache(chainId).get(prefixes.cache.keys.block(hash))
      const signedBlock = decodeSignedBlockExtended(api.registry, buffer)

      this.emit('telemetryBlockCacheHit', {
        chainId,
      })

      return signedBlock
    } catch (_error) {
      this.#log.warn('[%s] GET block after cache miss (%s)', chainId, hash)

      return await api.derive.chain.getBlock(hash)
    }
  }

  async getStorage(chainId: NetworkURN, storageKey: HexString, blockHash?: HexString) {
    try {
      const buffer = await this.#bufferCache(chainId).get(prefixes.cache.keys.storage(storageKey, blockHash))

      // TODO event
      this.emit('telemetryBlockCacheHit', {
        chainId,
      })

      return buffer
    } catch {
      return null
    }
  }

  /**
   * Returns true if there is a subscription for the
   * block caching.
   *
   */
  has(chainId: string) {
    return this.#subs[chainId] !== undefined
  }

  stop() {
    for (const [chain, sub] of Object.entries(this.#subs)) {
      this.#log.info(`Unsubscribe block cache of chain ${chain}`)
      sub.unsubscribe()
      delete this.#subs[chain]
    }
  }

  /**
   * Binary cache by chain id.
   */
  #bufferCache(chainId: NetworkURN) {
    return this.#db.sublevel<string, Uint8Array>(prefixes.cache.family(chainId), {
      valueEncoding: 'buffer',
    })
  }

  /**
   * Puts into the binary cache.
   */
  async #putBuffer(chainId: NetworkURN, key: string, buffer: Uint8Array) {
    const db = this.#bufferCache(chainId)
    await db.put(key, buffer)

    await this.#janitor.schedule({
      sublevel: prefixes.cache.family(chainId),
      key,
    })
  }

  async #putBlockBuffer(chainId: NetworkURN, block: SignedBlockExtended) {
    const hash = block.block.header.hash.toHex()
    const key = prefixes.cache.keys.block(hash)

    // TODO: review to use SCALE instead of CBOR
    await this.#bufferCache(chainId).put(key, encodeSignedBlockExtended(block))

    await this.#janitor.schedule({
      sublevel: prefixes.cache.family(chainId),
      key,
    })
  }

  #tapError<T>(chainId: NetworkURN, method: string) {
    return tap<T>({
      error: (e) => {
        this.#log.warn(e, 'error on method=%s, chain=%s', method, chainId)
        this.emit('telemetryBlockCacheError', {
          chainId,
          method,
        })
      },
    })
  }
}
