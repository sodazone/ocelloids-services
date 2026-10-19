import {
  catchError,
  concatMap,
  defer,
  EMPTY,
  from,
  interval,
  map,
  Observable,
  range,
  share,
  switchMap,
  timeout,
  timer,
  zipWith,
} from 'rxjs'
import { retryWithTruncatedExpBackoff } from '@/common/index.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { Backfill, INITIAL_DELAY_MS } from '../../backfill.js'
import { BackfillConfig } from '../../types.js'
import { RETRY_ONCE } from '../../watcher.js'
import { NearApi } from '../client.js'
import { NearBlock } from '../types.js'

export class NearBackfill extends Backfill<NearApi, NearBlock> {
  constructor(log: Logger, api$: (chainId: NetworkURN) => Observable<NearApi>) {
    super(log, api$)
  }

  start(chains: NetworkURN[]) {
    if (!this.backfillConfig) {
      return
    }

    this.log.info('[backfill:near] starting...')
    for (const chainId of chains) {
      const config = this.backfillConfig[chainId]
      if (!config) {
        this.log.warn('[backfill:%s] not configured. Skipping...', chainId)
        continue
      }
      this.log.info(
        '[backfill:%s] Initializing backfill stream blocks %s (emission=%sms)',
        chainId,
        config.ranges,
        config.emissionRate,
      )
      this.#initBlockStream(chainId as NetworkURN, config)
    }
    this.log.info('[backfill:near] started')
  }

  stop() {
    this.log.info('[backfill:near] stopped')
  }

  #initBlockStream(chainId: NetworkURN, config: BackfillConfig) {
    const { ranges, emissionRate } = config
    let first = true

    const chainBlock$ = this.api$(chainId).pipe(
      switchMap((api) => {
        const delay$ = first ? timer(INITIAL_DELAY_MS) : timer(100)
        first = false

        return delay$.pipe(
          switchMap(() =>
            from(ranges).pipe(
              concatMap(({ start, end }) => {
                const totalBlocks = end - start + 1
                return range(start, totalBlocks).pipe(
                  zipWith(interval(emissionRate)),
                  map(([blockNumber]) => blockNumber),
                )
              }),
              concatMap((blockNumber) => this.#getBlock(api, chainId, blockNumber)),
            ),
          ),
        )
      }),
      share(),
    )

    this.chainBlock$.set(chainId, chainBlock$)
    this.log.info(
      '[backfill:%s] stream initialized with %d explicit block ranges (rate: %dms)',
      chainId,
      ranges.length,
      emissionRate,
    )
  }

  #getBlock(api: NearApi, chainId: string, blockNumber: number): Observable<NearBlock> {
    return defer(() => from(api.getBlockBalanced(blockNumber))).pipe(
      timeout(10_000),
      retryWithTruncatedExpBackoff(RETRY_ONCE),
      map((block): NearBlock => ({ ...block, ingestionMode: 'backfill' })),
      catchError((err) => {
        this.log.warn(err, '[backfill:%s] Failed to getBlock for %s', chainId, blockNumber)
        return EMPTY
      }),
    )
  }
}
