import {
  catchError,
  EMPTY,
  from,
  lastValueFrom,
  map,
  merge,
  mergeMap,
  mergeWith,
  Observable,
  of,
  Subject,
  share,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
  timeout,
} from 'rxjs'

import { retryWithTruncatedExpBackoff, shutdown$ } from '@/common/index.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN, Services } from '@/services/types.js'

import Connector from '../../connector.js'
import { RETRY_INFINITE, Watcher as Watcher } from '../../watcher.js'
import { SubstrateNetworkInfo } from '../ingress/types.js'
import { Block, StorageChangeSets, SubstrateApi } from '../types.js'
import { SubstrateBackfill } from './backfill.js'
import { fetchers } from './fetchers.js'

const API_TIMEOUT_MS = 5 * 60_000

/**
 * The SubstrateWatcher performs the following tasks ("moo" 🐮):
 * - Catches up with block headers based on the height gap for finalized blocks.
 * - Caches on-chain storage data.
 * - Provides a new blocks stream.
 *
 * @see {Watcher["finalizedBlocks"]}
 * @see {Watcher.#catchUpHeads}
 */
export class SubstrateWatcher extends Watcher<Block> {
  readonly chainIds: NetworkURN[]

  readonly #watchdogTimers: Record<NetworkURN, NodeJS.Timeout> = {}
  readonly #api$ = {} as Record<NetworkURN, Subject<SubstrateApi>>
  readonly #apis: Record<string, SubstrateApi>
  readonly #apiCancel: Record<NetworkURN, Subject<void>> = {}
  readonly #finalized$: Record<NetworkURN, Observable<Block>> = {}
  readonly #new$: Record<NetworkURN, Observable<Block>> = {}
  readonly #backfill: SubstrateBackfill
  readonly #connector: Connector

  constructor(services: Services) {
    super(services)

    const { log, connector } = services

    this.#apis = connector.connectAll('substrate')
    this.#connector = connector
    this.chainIds = (Object.keys(this.#apis) as NetworkURN[]) ?? []
    this.#backfill = new SubstrateBackfill(log, this.getApi.bind(this))
  }

  start() {
    super.start()
    this.#backfill.start()
  }

  async stop() {
    this.log.info('[watcher:substrate] shutdown in-flight block streams')

    for (const timer of Object.values(this.#watchdogTimers)) {
      clearTimeout(timer)
    }

    function safeLastValueFrom<T>(obs: Observable<T>, ms = 1000): Promise<T | null> {
      return lastValueFrom(
        obs.pipe(
          timeout({ each: ms }),
          catchError(() => of(null)), // fallback if timeout or empty
        ),
      )
    }

    this.#backfill.stop()

    const finalizeds = Object.values(this.#finalized$).map((s) => safeLastValueFrom(s))
    await Promise.allSettled(finalizeds)

    const news = Object.values(this.#new$).map((s) => safeLastValueFrom(s))
    await Promise.allSettled(news)

    Object.values(this.#apiCancel).forEach((cancel$) => {
      try {
        cancel$.next()
        cancel$.complete()
      } catch {
        // ignore
      }
    })

    Object.values(this.#api$).forEach((subject) => subject?.complete())

    this.log.info('[watcher:substrate] shutdown OK')
  }

  /**
   * Returns an observable for new blocks.
   */
  newBlocks(chainId: NetworkURN): Observable<Block> {
    const cachedNew$ = this.#new$[chainId]

    if (cachedNew$) {
      this.log.debug('[%s] returning cached new blocks stream', chainId)
      return cachedNew$
    }

    const new$ = from(this.getApi(chainId)).pipe(
      switchMap((api) => {
        return api.followHeads$('new').pipe(
          takeUntil(shutdown$),
          this.tapError(chainId, 'newHeads()'),
          retryWithTruncatedExpBackoff(RETRY_INFINITE),
          mergeMap(({ hash, status }) =>
            from(api.getBlock(hash)).pipe(
              map((block) => Object.assign({ status }, block)),
              catchError((error) => {
                this.log.error(error, 'error while fetching block %s (%s)', hash, status)
                return EMPTY
              }),
            ),
          ),
        )
      }),
      share(),
    )

    this.#new$[chainId] = new$

    this.log.debug('[%s] created new blocks stream', chainId)

    return new$
  }

  /**
   * Returns an observable of finalized blocks.
   */
  finalizedBlocks(chainId: NetworkURN): Observable<Block> {
    const cachedFinalized$ = this.#finalized$[chainId]
    if (cachedFinalized$) {
      this.log.debug('[%s] returning cached finalized stream', chainId)
      return cachedFinalized$
    }

    if (!this.#api$[chainId]) {
      this.#api$[chainId] = new Subject<SubstrateApi>()
      void this.getApi(chainId).then((api) => this.#api$[chainId].next(api))
    }

    const backfill$ = this.#backfill.getBackfill$(chainId)

    const finalized$ = this.#api$[chainId].pipe(
      switchMap((api) => {
        // Create a fresh cancel token for this emitted api instance.
        // Any reconnect will signal this to force a clean teardown of streams tied to this api.
        if (this.#apiCancel[chainId]) {
          // close previous just in case
          try {
            this.#apiCancel[chainId].next()
            this.#apiCancel[chainId].complete()
          } catch {
            // ignore
          }
        }
        const cancel$ = new Subject<void>()
        this.#apiCancel[chainId] = cancel$

        const recovery$ = from(this.recoverRanges(chainId)).pipe(
          this.recoverBlockRanges(chainId, api),
          takeUntil(merge(shutdown$, cancel$)),
        )

        const liveFinalized$ = api.followHeads$('finalized').pipe(
          mergeWith(recovery$),
          this.tapError(chainId, 'finalizedHeads()'),
          retryWithTruncatedExpBackoff(RETRY_INFINITE),
          this.catchUpHeads(chainId, api),
          takeUntil(merge(shutdown$, cancel$)),
          mergeMap(({ hash, status }) =>
            from(api.getBlock(hash)).pipe(
              map((block) => ({ status, ...block })),
              catchError((error) => {
                this.log.error(error, '[%s] error fetching block %s (%s)', chainId, hash, status)
                return EMPTY
              }),
            ),
          ),
          this.tapError(chainId, 'blockFromHeader()'),
          retryWithTruncatedExpBackoff(RETRY_INFINITE),
          tap(() => this.#resetWatchdog(chainId)), // Reset watchdog on every block
        )

        return backfill$.pipe(mergeWith(liveFinalized$))
      }),
      catchError((err, caught) => {
        this.log.error('[%s] finalizedBlocks error: %s', chainId, err)
        return caught
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    )

    this.#finalized$[chainId] = finalized$

    this.log.debug('[%s] created finalized stream', chainId)

    return finalized$
  }

  getApi(chainId: NetworkURN): Promise<SubstrateApi> {
    return this.#apis[chainId].isReady()
  }

  /**
   * Waits for all API clients to be ready.
   */
  async isReady() {
    return await Promise.all(Object.values(this.#apis).map((api) => api.isReady()))
  }

  /**
   * Enumerates storage keys by a given key prefix.
   *
   * @param chainId The chain identifier.
   * @param keyPrefix  The storage key hex prefix.
   * @param count The number of results to get.
   * @param startKey The key to start from.
   * @param blockHash The block hash to query at.
   * @returns an array of storage keys as hex strings
   */
  getStorageKeys(
    chainId: NetworkURN,
    keyPrefix: HexString,
    count: number,
    startKey?: HexString,
    blockHash?: HexString,
  ): Observable<HexString[]> {
    const resolvedStartKey = startKey === '0x0' ? undefined : startKey
    const at = blockHash === undefined || blockHash === '0x0' ? undefined : blockHash
    return from(this.#apis[chainId].getStorageKeys(keyPrefix, count, resolvedStartKey, at)).pipe(
      this.tapError(
        chainId,
        `state_getKeysPaged(${keyPrefix}, ${count}, ${startKey ?? 'start'}, ${blockHash ?? 'latest'})`,
      ),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
    )
  }

  getStorage(chainId: NetworkURN, storageKey: HexString, blockHash?: HexString): Observable<HexString> {
    return from(this.#apis[chainId].getStorage(storageKey, blockHash)).pipe(
      this.tapError(chainId, `state_getStorage(${storageKey}, ${blockHash ?? 'latest'})`),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
    )
  }

  queryStorageAt(
    chainId: NetworkURN,
    storageKeys: HexString[],
    blockHash?: HexString,
  ): Observable<StorageChangeSets> {
    return from(this.#apis[chainId].queryStorageAt(storageKeys, blockHash)).pipe(
      this.tapError(chainId, `state_queryStorageAt(${storageKeys}, ${blockHash ?? 'latest'})`),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
    )
  }

  async runtimeCall<T = any>(
    chainId: NetworkURN,
    opts: { api: string; method: string; at?: string },
    args: any[],
  ): Promise<T | null> {
    return await this.#apis[chainId].runtimeCall<T>(opts, args)
  }

  async getNetworkInfo(chainId: NetworkURN): Promise<SubstrateNetworkInfo> {
    return await fetchers.networkInfo(await this.#apis[chainId].isReady(), chainId)
  }

  async #reconnect(chainId: NetworkURN) {
    this.log.info('[watcher:substrate] %s reconnecting API', chainId)
    const existingApi = this.#apis?.[chainId]
    if (existingApi) {
      try {
        // 1) Signal cancellation to any streams tied to the old API.
        const cancel$ = this.#apiCancel[chainId]
        try {
          if (cancel$) {
            cancel$.next()
            cancel$.complete()
            delete this.#apiCancel[chainId]
          }
        } catch (err) {
          this.log.warn(err, '[%s] error while signaling api cancel', chainId)
        }

        // 2) Give the unsubscription microtask a short moment to complete.
        await new Promise((res) => setTimeout(res, 50))

        // 3) Disconnect the old API
        try {
          await existingApi.disconnect()
        } catch (err) {
          // best effort; log and continue to replace
          this.log.warn(err, '[%s] error during api.disconnect()', chainId)
        }

        // 4) Replace API
        const newApi = (await this.#connector.replaceNetwork('substrate', chainId).connect()) as SubstrateApi
        this.#apis[chainId] = newApi

        this.log.info('[watcher:substrate] %s reconnect OK', chainId)

        // 5) Emit the new API on the same Subject so finalized$ subscribers will switchMap to the new API.
        // Important: we reuse the original Subject instance (this.#api$[chainId]) so downstream stream references remain valid.
        if (!this.#api$[chainId]) {
          this.#api$[chainId] = new Subject<SubstrateApi>()
        }
        this.#api$[chainId].next(this.#apis[chainId])
        this.log.info('[watcher:substrate] %s emit API', chainId)

        this.emit('telemetryApiReconnect', {
          chainId,
        })
      } catch (error) {
        this.log.error(error, 'error')
      }
    }
  }

  #resetWatchdog(chainId: NetworkURN) {
    if (this.#watchdogTimers[chainId]) {
      clearTimeout(this.#watchdogTimers[chainId])
    }

    this.#watchdogTimers[chainId] = setTimeout(() => {
      this.log.warn('[%s] no finalized block for %dms, reconnecting...', chainId, API_TIMEOUT_MS)
      void this.#reconnect(chainId)
    }, API_TIMEOUT_MS)
  }
}
