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
  Observable,
  of,
  Subject,
  share,
  switchMap,
  takeUntil,
  tap,
  timeout,
  timer,
} from 'rxjs'
import { retryWithTruncatedExpBackoff, shutdown$ } from '@/common/index.js'
import { AnyJson, NetworkURN, Services } from '@/services/types.js'
import Connector from '../../connector.js'
import { NeutralHeader } from '../../types.js'
import { RETRY_INFINITE, Watcher } from '../../watcher.js'
import { NearApi, NearBlock, NearTxStatus } from '../client.js'

const API_TIMEOUT_MS = 4 * 60_000

export class NearWatcher extends Watcher<NearBlock> {
  readonly #watchdogTimers: Record<NetworkURN, NodeJS.Timeout> = {}
  readonly #api$: Record<NetworkURN, BehaviorSubject<NearApi>> = {}
  readonly #apis: Record<string, NearApi>
  readonly #finalized$: Record<NetworkURN, Observable<NearBlock>> = {}
  readonly #new$: Record<NetworkURN, Observable<NearBlock>> = {}
  readonly #apiCancel: Record<NetworkURN, Subject<void>> = {}

  readonly chainIds: NetworkURN[]
  readonly #connector: Connector

  constructor(services: Services) {
    super(services)

    const { connector } = services

    this.#connector = connector
    this.#apis = connector.connectAll('near')
    this.chainIds = (Object.keys(this.#apis) as NetworkURN[]) ?? []
  }

  start() {
    super.start()
  }

  async stop() {
    this.log.info('[watcher:near] shutdown in-flight block streams')

    for (const timer of Object.values(this.#watchdogTimers)) {
      clearTimeout(timer)
    }

    function safeLastValueFrom<T>(obs: Observable<T>, ms = 1000): Promise<T | null> {
      return lastValueFrom(
        obs.pipe(
          timeout({ each: ms }),
          catchError(() => of(null)),
        ),
      )
    }

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

    this.log.info('[watcher:near] shutdown OK')
  }

  newBlocks(chainId: NetworkURN): Observable<NearBlock> {
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
          mergeMap((header) => api.getBlockBalanced(header.hash)),
          this.tapError(chainId, 'getBlockBalanced()'),
          retryWithTruncatedExpBackoff(RETRY_INFINITE),
          share(),
        ),
      ),
    )
    this.#new$[chainId] = new$

    this.log.debug('[%s] created new blocks stream', chainId)

    return new$
  }

  finalizedBlocks(chainId: NetworkURN): Observable<NearBlock> {
    const cachedFinalized$ = this.#finalized$[chainId]

    if (cachedFinalized$) {
      this.log.debug('[%s] returning cached finalized stream', chainId)
      return cachedFinalized$
    }

    if (!this.#api$[chainId]) {
      this.#api$[chainId] = new BehaviorSubject(this.#apis[chainId])
    }

    if (this.#apiCancel[chainId]) {
      try {
        this.#apiCancel[chainId].next()
        this.#apiCancel[chainId].complete()
      } catch {
        // ignore
      }
    }
    const cancel$ = new Subject<void>()
    this.#apiCancel[chainId] = cancel$

    let lastReset = Date.now()

    const finalized$ = this.#api$[chainId].pipe(
      switchMap((api) => {
        const live$ = api.followHeads$('finalized').pipe(
          takeUntil(merge(shutdown$, cancel$)),
          this.tapError(chainId, 'finalizedBlocks()'),
          retryWithTruncatedExpBackoff(RETRY_INFINITE),
          this.#catchUpBlocks(chainId, api),
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

        return live$.pipe(
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

  async getNetworkInfo(chainId: string): Promise<AnyJson> {
    const info = this.#apis[chainId].getNetworkInfo()
    return Promise.resolve(info as unknown as AnyJson)
  }

  async getTransactionStatus(
    chainId: string,
    txHash: string,
    senderAccountId: string,
  ): Promise<NearTxStatus> {
    return await this.#apis[chainId].getTransactionStatus(txHash, senderAccountId)
  }

  getApi$(chainId: NetworkURN): Observable<NearApi> {
    if (!this.#api$[chainId]) {
      this.#api$[chainId] = new BehaviorSubject(this.#apis[chainId])
    }

    return this.#api$[chainId]
  }

  #catchUpBlocks(chainId: NetworkURN, api: NearApi) {
    return (source: Observable<NeutralHeader>): Observable<NearBlock> =>
      source.pipe(
        concatMap((newHead) =>
          defer(async () => {
            const tip = await this.chainTips.get(chainId)
            return tip ? Number(tip.blockNumber) : newHead.height - 1
          }).pipe(
            switchMap((lastFetched) => {
              const target = newHead.height
              const maxDist = this.maxBlockDist(chainId)
              const effectiveLastFetched = target - lastFetched > maxDist ? target - maxDist : lastFetched

              if (target <= effectiveLastFetched) {
                return EMPTY
              }

              if (target - effectiveLastFetched > 1) {
                this.log.info(
                  '[%s] CATCHUP starting from #%s down to > #%s',
                  chainId,
                  target,
                  effectiveLastFetched + 1,
                )
              }

              const self = this

              return from(
                (async function* () {
                  let currentId: string | number = (newHead as NeutralHeader).hash
                  let count = 0

                  while (true) {
                    // Throttle subsequent calls to api.getBlockBalanced by 500ms
                    if (count > 0) {
                      await new Promise((res) => setTimeout(res, 350))
                    }

                    let block: NearBlock | null = null

                    try {
                      block = await api.getBlockBalanced(currentId)
                    } catch (err) {
                      self.log.error(err, '[%s] failed to fetch block %s.', chainId, currentId)
                    }

                    if (!block) {
                      break
                    }

                    count++
                    yield { ...block, ingestionMode: 'live' as const }

                    if (block.number <= effectiveLastFetched + 1) {
                      break
                    }

                    const parentHeight = block.header?.prev_height
                    const parentHash = block.header?.prev_hash

                    if (
                      parentHeight &&
                      typeof parentHeight === 'number' &&
                      parentHeight > effectiveLastFetched
                    ) {
                      currentId = parentHeight
                    } else if (parentHash) {
                      currentId = parentHash
                    } else {
                      break
                    }
                  }

                  // At the end, store the chain tip with the highest height
                  await self.chainTips.put(chainId, {
                    blockHash: newHead.hash,
                    blockNumber: newHead.height.toString(),
                    chainId,
                    parentHash: newHead.parenthash,
                    receivedAt: new Date(),
                  })
                  self.log.info(
                    '[%s] CATCHUP finished, chaintip updated to highest #%s %s',
                    chainId,
                    newHead.height,
                    newHead.hash,
                  )
                })(),
              ).pipe(
                this.tapError(chainId, 'getBlockBalanced()'),
                retryWithTruncatedExpBackoff(RETRY_INFINITE),
              )
            }),
          ),
        ),
      )
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

  async #reconnect(chainId: NetworkURN) {
    this.log.info('[watcher:near] %s reconnecting API', chainId)
    const existingApi = this.#apis?.[chainId]
    if (existingApi) {
      try {
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

        await new Promise((res) => setTimeout(res, 50))

        try {
          await existingApi.disconnect()
        } catch (err) {
          this.log.warn(err, '[%s] error during api.disconnect()', chainId)
        }

        const newApi = this.#connector.replaceNetwork('near', chainId)
        this.#apis[chainId] = newApi

        this.log.info('[watcher:near] %s reconnect OK', chainId)

        if (!this.#api$[chainId]) {
          this.#api$[chainId] = new BehaviorSubject<NearApi>(newApi)
        } else {
          this.#api$[chainId].next(this.#apis[chainId])
        }

        this.emit('telemetryApiReconnect', { chainId })
      } catch (error) {
        this.log.error(error, 'error')
      }
    }
  }
}
