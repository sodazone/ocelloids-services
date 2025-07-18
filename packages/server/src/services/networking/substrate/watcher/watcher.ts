import {
  EMPTY,
  Observable,
  catchError,
  defer,
  from,
  lastValueFrom,
  map,
  mergeMap,
  mergeWith,
  of,
  share,
  switchMap,
  takeUntil,
  timeout,
} from 'rxjs'

import { retryWithTruncatedExpBackoff, shutdown$ } from '@/common/index.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN, Services } from '@/services/types.js'

import { RETRY_INFINITE, Watcher as Watcher } from '../../watcher.js'
import { SubstrateNetworkInfo } from '../ingress/types.js'
import { Block, SubstrateApi } from '../types.js'
import { backfillBlocks$, getBackfillRangesSync, loadGapsFileSync } from './backfill.js'
import { fetchers } from './fetchers.js'

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
  readonly #apis: Record<string, SubstrateApi>
  readonly #finalized$: Record<NetworkURN, Observable<Block>> = {}
  readonly #new$: Record<NetworkURN, Observable<Block>> = {}

  constructor(services: Services) {
    super(services)

    const { connector } = services

    this.#apis = connector.connect('substrate')
    this.chainIds = (Object.keys(this.#apis) as NetworkURN[]) ?? []
  }

  start() {
    super.start()

    loadGapsFileSync(process.env.OC_SUBSTRATE_BACKFILL_FILE)
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

    const api$ = from(this.getApi(chainId))

    const backfill$ = defer(() => {
      const range = getBackfillRangesSync(chainId)
      if (range === null) {
        return EMPTY
      }
      return backfillBlocks$(this.log, { api$, chainId, start: range[0], end: range[1], rate: range[2] })
    })

    const finalized$ = api$.pipe(
      switchMap((api) => {
        const recovery$ = from(this.recoverRanges(chainId)).pipe(
          this.recoverBlockRanges(chainId, api),
          takeUntil(shutdown$),
        )

        const liveFinalized$ = api.followHeads$('finalized').pipe(
          mergeWith(recovery$),
          this.tapError(chainId, 'finalizedHeads()'),
          retryWithTruncatedExpBackoff(RETRY_INFINITE),
          this.catchUpHeads(chainId, api),
          takeUntil(shutdown$),
          mergeMap(({ hash, status }) =>
            from(api.getBlock(hash)).pipe(
              map((block) => ({ status, ...block })),
              catchError((error) => {
                this.log.error(error, 'error fetching block %s (%s)', hash, status)
                return EMPTY
              }),
            ),
          ),
          this.tapError(chainId, 'blockFromHeader()'),
          retryWithTruncatedExpBackoff(RETRY_INFINITE),
        )

        return backfill$.pipe(mergeWith(liveFinalized$))
      }),
      share(),
    )

    this.#finalized$[chainId] = finalized$

    this.log.debug('[%s] created finalized stream', chainId)

    return finalized$
  }

  getApi(chainId: NetworkURN): Promise<SubstrateApi> {
    return this.#apis[chainId].isReady()
  }

  async stop() {
    this.log.info('[watcher:substrate] shutdown in-flight block streams')

    function safeLastValueFrom<T>(obs: Observable<T>, ms = 1000): Promise<T | null> {
      return lastValueFrom(
        obs.pipe(
          timeout({ each: ms }),
          catchError(() => of(null)), // fallback if timeout or empty
        ),
      )
    }

    const finalizeds = Object.values(this.#finalized$).map((s) => safeLastValueFrom(s))
    await Promise.allSettled(finalizeds)

    const news = Object.values(this.#new$).map((s) => safeLastValueFrom(s))
    await Promise.allSettled(news)

    this.log.info('[watcher:substrate] shutdown OK')
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

  async getNetworkInfo(chainId: NetworkURN): Promise<SubstrateNetworkInfo> {
    return await fetchers.networkInfo(await this.#apis[chainId].isReady(), chainId)
  }
}
