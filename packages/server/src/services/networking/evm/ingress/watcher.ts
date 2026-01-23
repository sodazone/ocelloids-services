import {
  BehaviorSubject,
  catchError,
  concatMap,
  defer,
  EMPTY,
  finalize,
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
  take,
  takeUntil,
  tap,
  timeout,
  toArray,
} from 'rxjs'
import { MulticallParameters, SocketClosedError } from 'viem'
import { retryWithTruncatedExpBackoff, shutdown$ } from '@/common/index.js'
import { HexString } from '@/lib.js'
import { AnyJson, NetworkURN, Services } from '@/services/types.js'
import Connector from '../../connector.js'
import { NeutralHeader } from '../../types.js'
import { RETRY_INFINITE, retryCapped, Watcher } from '../../watcher.js'
import { EvmApi } from '../client.js'
import { Block, DecodeContractParams } from '../types.js'
import { EvmBackfill } from './backfill.js'

const API_TIMEOUT_MS = 4 * 60_000

const BATCH_SIZE = 9
const CONCURRENT_FETCH = 3

const FAST_CHAINS: NetworkURN[] = ['urn:ocn:ethereum:42161', 'urn:ocn:ethereum:56']

/**
 * Evm Watcher.
 *
 * Provides streams of new and finalized blocks with logs for EVM chains.
 *
 * NOTE:
 * - RPC endpoints (especially free/public ones) may produce gaps, duplicate blocks, and out-of-order events.
 * - This watcher applies best-effort strategies to improve reliability:
 *    - Attempts to fill gaps automatically.
 *    - Deduplicates blocks where possible.
 *    - Handles short reorgs and attempts to emit finalized blocks in order.
 * - While the watcher mitigates inconsistencies, out-of-order blocks or duplicates
 *   may still occur in rare cases, particularly on unstable endpoints.
 */
export class EvmWatcher extends Watcher<Block> {
  readonly #watchdogTimers: Record<NetworkURN, NodeJS.Timeout> = {}
  readonly #api$: Record<NetworkURN, BehaviorSubject<EvmApi>> = {}
  readonly #apis: Record<string, EvmApi>
  readonly #finalized$: Record<NetworkURN, Observable<Block>> = {}
  readonly #new$: Record<NetworkURN, Observable<Block>> = {}
  readonly #apiCancel: Record<NetworkURN, Subject<void>> = {}
  readonly #backfill: EvmBackfill

  readonly chainIds: NetworkURN[]
  readonly #connector: Connector

  constructor(services: Services) {
    super(services)

    const { log, connector } = services

    this.#connector = connector
    this.#apis = connector.connectAll('evm')
    this.chainIds = (Object.keys(this.#apis) as NetworkURN[]) ?? []
    this.#backfill = new EvmBackfill(log, this.getApi$.bind(this))
  }

  start() {
    super.start()
    this.#backfill.start(Object.keys(this.#apis) as NetworkURN[])
  }

  async stop() {
    this.log.info('[watcher:evm] shutdown in-flight block streams')

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

    this.log.info('[watcher:evm] shutdown OK')
  }

  newBlocks(chainId: NetworkURN): Observable<Block> {
    const cachedNew$ = this.#new$[chainId]

    if (cachedNew$) {
      this.log.debug('[%s] returning cached new stream', chainId)
      return cachedNew$
    }

    if (!this.#api$[chainId]) {
      this.#api$[chainId] = new BehaviorSubject(this.#apis[chainId])
    }

    const new$ = this.#api$[chainId].pipe(
      switchMap((api) =>
        api.followHeads$('new').pipe(
          takeUntil(shutdown$),
          this.catchUpHeads(chainId, api),
          this.handleReorgs(chainId, api),
          mergeMap((header) => api.getBlock(header.hash)),
          this.tapError(chainId, 'getBlock()'),
          retryWithTruncatedExpBackoff(RETRY_INFINITE),
          share(),
        ),
      ),
    )
    this.#new$[chainId] = new$

    this.log.debug('[%s] created new blocks stream', chainId)

    return new$
  }

  finalizedBlocks(chainId: NetworkURN): Observable<Block> {
    const cachedFinalized$ = this.#finalized$[chainId]

    if (cachedFinalized$) {
      this.log.debug('[%s] returning cached finalized stream', chainId)
      return cachedFinalized$
    }

    if (!this.#api$[chainId]) {
      this.#api$[chainId] = new BehaviorSubject(this.#apis[chainId])
    }

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

    if (FAST_CHAINS.includes(chainId)) {
      return this.#fastFinalizedBlocks(chainId)
    }

    return this.#finalizedBlocks(chainId)
  }

  #finalizedBlocks(chainId: NetworkURN): Observable<Block> {
    const cancel$ = this.#apiCancel[chainId]
    let lastReset = Date.now()

    const backfill$ = this.#backfill.getBackfill$(chainId)
    const finalized$ = this.#api$[chainId].pipe(
      switchMap((api) => {
        const live$ = api.followHeads$('finalized').pipe(
          takeUntil(merge(shutdown$, cancel$)),
          this.tapError(chainId, 'finalizedBlocks()'),
          retryWithTruncatedExpBackoff(RETRY_INFINITE),
          this.catchUpHeads(chainId, api),
          this.handleReorgs(chainId, api),
          mergeMap((header) => from(api.getBlock(header.hash))),
          this.tapError(chainId, 'getBlock()'),
          retryWithTruncatedExpBackoff(RETRY_INFINITE),
          tap((block) => {
            this.log.info('[%s] FINALIZED block #%s %s', chainId, block.number, block.hash)

            this.emit('telemetryBlockFinalized', {
              chainId,
              blockNumber: Number(block.number),
            })
            const now = Date.now()

            if (now - lastReset > 10_000) {
              lastReset = now
              this.#resetWatchdog(chainId)
            }
          }),
        )
        return backfill$.pipe(
          mergeWith(live$),
          takeUntil(merge(shutdown$, cancel$)),
          finalize(() => this.log.info('[%s] Inner finalized block stream completed', chainId)),
        )
      }),
      share({ resetOnRefCountZero: false }),
    )

    this.#finalized$[chainId] = finalized$

    this.log.debug('[%s] created finalized blocks stream', chainId)

    return finalized$
  }

  #fastFinalizedBlocks(chainId: NetworkURN): Observable<Block> {
    const cancel$ = this.#apiCancel[chainId]
    let lastLog = Date.now()
    const blockNumbers: string[] = []
    const backfill$ = this.#backfill.getBackfill$(chainId)
    const finalized$ = this.#api$[chainId].pipe(
      switchMap((api) => {
        const live$ = api.followFastHeads$('finalized').pipe(
          takeUntil(merge(shutdown$, cancel$)),
          this.tapError(chainId, 'followHeads()'),
          retryWithTruncatedExpBackoff(RETRY_INFINITE),
          this.#catchUpBlocks(chainId, api),
          tap((b) => {
            blockNumbers.push(b.number)
            const now = Date.now()
            if (now - lastLog > 5_000) {
              this.log.info(
                '[%s] FINALIZED %s blocks (last=%s) [%s]',
                chainId,
                blockNumbers.length,
                blockNumbers[blockNumbers.length - 1],
                blockNumbers.join(', '),
              )
              this.#resetWatchdog(chainId)
              lastLog = now
              blockNumbers.length = 0
            }
            this.emit('telemetryBlockFinalized', {
              chainId,
              blockNumber: Number(b.number),
            })
          }),
          takeUntil(merge(shutdown$, cancel$)),
        )
        return backfill$.pipe(
          mergeWith(live$),
          takeUntil(merge(shutdown$, cancel$)),
          finalize(() => this.log.info('[%s] Inner finalized block stream completed', chainId)),
        )
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    )

    this.#finalized$[chainId] = finalized$

    this.log.debug('[%s] created finalized blocks stream', chainId)

    return finalized$
  }

  watchEvents(chainId: NetworkURN, params: DecodeContractParams, eventNames?: string[]) {
    if (!this.#api$[chainId]) {
      this.#api$[chainId] = new BehaviorSubject(this.#apis[chainId])
    }

    return this.#api$[chainId].pipe(
      switchMap((api) =>
        defer(() => api.watchEvents$(params, eventNames)).pipe(
          this.tapError(chainId, 'watchEvents()'),
          retryWithTruncatedExpBackoff(retryCapped(3)),
          catchError((err) => {
            if (err instanceof SocketClosedError) {
              this.log.info('[%s] reconnecting API due to SocketClosedError', chainId)

              this.#reconnect(chainId)
            }

            return this.#api$[chainId].pipe(
              take(1),
              switchMap((api) => api.watchEvents$(params, eventNames)),
            )
          }),
        ),
      ),
    )
  }

  getNetworkInfo(chainId: string): Promise<AnyJson> {
    const chain = this.#apis[chainId].getNetworkInfo()
    return Promise.resolve(chain as unknown as AnyJson)
  }

  async getTransactionReceipt(chainId: string, txHash: HexString) {
    return await this.#apis[chainId].getTransactionReceipt(txHash)
  }

  async multiCall(chainId: string, args: MulticallParameters) {
    return await this.#apis[chainId].multiCall(args)
  }

  protected override catchUpHeads(chainId: NetworkURN, api: EvmApi) {
    return (source: Observable<NeutralHeader>): Observable<NeutralHeader> => {
      return source.pipe(
        concatMap((newHead) =>
          defer(async () => {
            const tip = await this.chainTips.get(chainId)
            return tip ? Number(tip.blockNumber) : newHead.height - 1
          }).pipe(
            switchMap((lastFetched) => {
              const target = newHead.height

              if (target <= lastFetched) {
                return EMPTY
              }
              if (target === lastFetched + 1) {
                return from(api.getNeutralBlockHeaderByNumber(target)).pipe(
                  this.tapError(chainId, 'getNeutralBlockHeaderByNumber()'),
                  retryWithTruncatedExpBackoff(RETRY_INFINITE),
                  mergeMap((header) =>
                    defer(async () => {
                      await this.chainTips.put(chainId, {
                        blockHash: header.hash,
                        blockNumber: header.height.toString(),
                        chainId,
                        parentHash: header.parenthash,
                        receivedAt: new Date(),
                      })
                      return header
                    }),
                  ),
                )
              }

              const missing: number[] = []
              const maxDist = this.maxBlockDist(chainId)
              const start = target - lastFetched > maxDist ? target - maxDist : lastFetched
              for (let h = start + 1; h <= target; h++) {
                missing.push(h)
              }
              this.log.info('[%s] CATCHUP #%s - #%s', chainId, start + 1, target)

              const batches: number[][] = []
              const batchSize = this.batchSize(chainId)
              for (let i = 0; i < missing.length; i += batchSize) {
                batches.push(missing.slice(i, i + batchSize))
              }

              return from(batches).pipe(
                mergeMap(
                  (batch) =>
                    from(batch).pipe(
                      mergeMap((h) => api.getNeutralBlockHeaderByNumber(h), CONCURRENT_FETCH),
                      this.tapError(chainId, 'getNeutralBlockHeaderByNumber()'),
                      retryWithTruncatedExpBackoff(RETRY_INFINITE),
                      toArray(),
                      map((b) => b.sort((a, b) => a.height - b.height)),
                      mergeMap((blocks) =>
                        defer(async () => {
                          const last = blocks[blocks.length - 1]
                          await this.chainTips.put(chainId, {
                            blockHash: last.hash,
                            blockNumber: last.height.toString(),
                            chainId,
                            parentHash: last.parenthash,
                            receivedAt: new Date(),
                          })
                          return blocks
                        }),
                      ),
                      mergeMap((blocks) => from(blocks)),
                    ),
                  1,
                ),
              )
            }),
          ),
        ),
        this.tapError(chainId, '#catchUpHeads()'),
        retryWithTruncatedExpBackoff(RETRY_INFINITE),
      )
    }
  }

  // Fast catchup logic; directly fetches full blocks with txs by block number
  // Does not handle reorgs
  #catchUpBlocks(chainId: NetworkURN, api: EvmApi) {
    return (source: Observable<NeutralHeader>): Observable<Block> =>
      source.pipe(
        concatMap((newHead) =>
          defer(async () => {
            const tip = await this.chainTips.get(chainId)
            return tip ? Number(tip.blockNumber) : newHead.height - 1
          }).pipe(
            switchMap((lastFetched) => {
              const target = newHead.height

              if (target <= lastFetched) {
                return EMPTY
              }

              if (target === lastFetched + 1) {
                return from(api.getBlockByNumber(target)).pipe(
                  this.tapError(chainId, 'getBlockByNumber()'),
                  retryWithTruncatedExpBackoff(RETRY_INFINITE),
                  mergeMap((block) =>
                    defer(async () => {
                      await this.chainTips.put(chainId, {
                        blockHash: block.hash,
                        blockNumber: block.number,
                        chainId,
                        parentHash: block.parentHash,
                        receivedAt: new Date(),
                      })
                      return block
                    }),
                  ),
                )
              }

              const missing: number[] = []
              const maxDist = this.maxBlockDist(chainId)
              const start = target - lastFetched > maxDist ? target - maxDist : lastFetched
              for (let h = start + 1; h <= target; h++) {
                missing.push(h)
              }
              this.log.info('[%s] CATCHUP #%s - #%s', chainId, start + 1, target)

              const batches: number[][] = []
              for (let i = 0; i < missing.length; i += BATCH_SIZE) {
                batches.push(missing.slice(i, i + BATCH_SIZE))
              }

              return from(batches).pipe(
                mergeMap(
                  (batch) =>
                    from(batch).pipe(
                      mergeMap((n) => api.getBlockByNumber(n), CONCURRENT_FETCH),
                      this.tapError(chainId, 'getBlockByNumber()'),
                      retryWithTruncatedExpBackoff(RETRY_INFINITE),
                      toArray(),
                      mergeMap((blocks) =>
                        defer(async () => {
                          const last = blocks.reduce((max, b) =>
                            Number(b.number) > Number(max.number) ? b : max,
                          )
                          await this.chainTips.put(chainId, {
                            blockHash: last.hash,
                            blockNumber: last.number,
                            chainId,
                            parentHash: last.parentHash,
                            receivedAt: new Date(),
                          })
                          return blocks
                        }),
                      ),
                      mergeMap((blocks) => from(blocks)),
                    ),
                  1,
                ),
              )
            }),
          ),
        ),
      )
  }

  async #reconnect(chainId: NetworkURN) {
    this.log.info('[watcher:evm] %s reconnecting API', chainId)
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
        const newApi = this.#connector.replaceNetwork('evm', chainId)
        this.#apis[chainId] = newApi

        this.log.info('[watcher:evm] %s reconnect OK', chainId)

        // 5) Emit the new API on the same Subject so finalized$ subscribers will switchMap to the new API.
        // Important: we reuse the original Subject instance (this.#api$[chainId]) so downstream stream references remain valid.
        if (!this.#api$[chainId]) {
          this.#api$[chainId] = new BehaviorSubject<EvmApi>(newApi)
        } else {
          this.#api$[chainId].next(this.#apis[chainId])
        }
        this.log.info('[watcher:evm] %s emit API', chainId)

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

  getApi$(chainId: NetworkURN): Observable<EvmApi> {
    if (!this.#api$[chainId]) {
      this.#api$[chainId] = new BehaviorSubject(this.#apis[chainId])
    }

    return this.#api$[chainId]
  }
}
