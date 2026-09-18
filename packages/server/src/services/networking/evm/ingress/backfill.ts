import {
  catchError,
  concatMap,
  defer,
  EMPTY,
  from,
  interval,
  map,
  mergeMap,
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
import { RETRY_ONCE, retryCapped } from '../../watcher.js'
import { EvmApi } from '../client.js'
import { Block, EvmLog } from '../types.js'

const MAX_BLOCK_RANGE_SIZE = 150

export class EvmBackfill extends Backfill<EvmApi, Block> {
  readonly chainLogs$ = new Map<string, Observable<EvmLog>>()

  constructor(log: Logger, api$: (chainId: NetworkURN) => Observable<EvmApi>) {
    super(log, api$)
  }

  start(chains: NetworkURN[]) {
    if (!this.backfillConfig) {
      return
    }

    this.log.info('[backfill:evm] starting...')
    for (const chainId of chains) {
      const config = this.backfillConfig[chainId]
      if (!config) {
        this.log.warn('[backfill:%s] not configured. Skipping...')
        continue
      }
      this.log.info(
        '[backfill:%s] Initializing backfill stream blocks %s (emission=%sms)',
        chainId,
        config.ranges,
        config.emissionRate,
      )
      if (config.blocks) {
        this.#initBlockStream(chainId as NetworkURN, config)
      }
      if (config.logs) {
        this.#initLogsStream(chainId as NetworkURN, config)
      }
    }
    this.log.info('[backfill:evm] started')
  }

  stop() {
    this.log.info('[backfill:evm] stopped')
  }

  getLogsBackfill$(chainId: NetworkURN): Observable<EvmLog> {
    const backfill$ = this.chainLogs$.get(chainId)
    if (!backfill$) {
      return EMPTY
    }
    return backfill$
  }

  #initBlockStream(chainId: NetworkURN, config: BackfillConfig) {
    const { ranges, emissionRate } = config
    let first = true

    const chainBlock$ = this.api$(chainId).pipe(
      switchMap((api) => {
        const delay$ = first ? timer(INITIAL_DELAY_MS) : timer(10)
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

  #initLogsStream(chainId: NetworkURN, config: BackfillConfig) {
    const { ranges, emissionRate } = config
    let first = true

    const logs$ = this.api$(chainId).pipe(
      switchMap((api) => {
        const delay$ = first ? timer(INITIAL_DELAY_MS) : timer(10)
        first = false

        return delay$.pipe(
          switchMap(() =>
            from(ranges).pipe(
              zipWith(interval(emissionRate)),
              concatMap(([{ start, end }]) => {
                const ranges: { fromBlock: number; toBlock: number }[] = []
                for (let fromBlock = start; fromBlock <= end; fromBlock += MAX_BLOCK_RANGE_SIZE) {
                  const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE_SIZE - 1, end)
                  ranges.push({ fromBlock, toBlock })
                }

                this.log.info(
                  '[backfill:%s] Fetching logs from #%s to #%s in %s chunk(s)',
                  chainId,
                  start,
                  end,
                  ranges.length,
                )

                return from(ranges).pipe(
                  concatMap(({ fromBlock, toBlock }) =>
                    from(api.getLogsInRange(BigInt(fromBlock), BigInt(toBlock))).pipe(
                      retryWithTruncatedExpBackoff(retryCapped(10)),
                      mergeMap((logs) => from(logs)),
                      catchError((err) => {
                        this.log.error(
                          err,
                          '[backfill:%s] Exhausted retries for range %s-%s:',
                          chainId,
                          fromBlock,
                          toBlock,
                        )
                        return EMPTY
                      }),
                    ),
                  ),
                )
              }),
            ),
          ),
        )
      }),
      share(),
    )

    this.chainLogs$.set(chainId, logs$)
    this.log.info('[backfill:%s] stream initialized with %d explicit block ranges', chainId, ranges.length)
  }

  #getBlock(api: EvmApi, chainId: string, blockNumber: number): Observable<Block> {
    return defer(() => from(api.getBlockByNumber(blockNumber))).pipe(
      timeout(10_000),
      retryWithTruncatedExpBackoff(RETRY_ONCE),
      map((block): Block => ({ ...block, ingestionMode: 'backfill' })),
      catchError((err) => {
        this.log.warn(err, '[backfill:%s] Failed to getBlock for %s', chainId, blockNumber)
        return EMPTY
      }),
    )
  }
}
