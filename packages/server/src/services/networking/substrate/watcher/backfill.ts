import fs from 'fs'
import path from 'path'

import { EMPTY, Observable, defer, from, interval, range } from 'rxjs'
import { catchError, delay, map, mergeMap, switchMap, tap, zipWith } from 'rxjs/operators'

import { retryWithTruncatedExpBackoff } from '@/common/index.js'
import { Logger } from '@/services/types.js'
import { RETRY_CAPPED } from '../../watcher.js'
import { Block, SubstrateApi } from '../types.js'

type GapRange = [number, number, number]
type GapsMap = Record<string, GapRange>

let cachedGapsMap: GapsMap = {}

const INITIAL_DELAY_MS = 0.1 * 60 * 1_000 // 5 minutes
const EMIT_INTERVAL_MS = 1_000 // 1s
const MAX_CONCURRENT_BLOCK_REQUESTS = 1

export function backfillBlocks$(
  log: Logger,
  {
    api$,
    start,
    end,
    chainId,
    rate,
  }: { api$: Observable<SubstrateApi>; chainId: string; start: number; end: number; rate: number },
): Observable<Block> {
  const total = end - start + 1
  let count = 0

  log.info('[%s] backfilling stream %s-%s', chainId, start, end)

  return api$.pipe(
    delay(INITIAL_DELAY_MS),
    switchMap((api) =>
      range(start, total).pipe(
        zipWith(interval(EMIT_INTERVAL_MS * rate)),
        map(([blockNumber]) => blockNumber),
        mergeMap(
          // use controlled concurrency
          (blockNumber) =>
            defer(() =>
              from(api.getBlockHash(blockNumber)).pipe(
                retryWithTruncatedExpBackoff(RETRY_CAPPED),
                tapError(log, chainId, 'getBlockHash'),
                mergeMap(
                  (hash) =>
                    defer(() => from(api.getBlock(hash, false))).pipe(
                      retryWithTruncatedExpBackoff(RETRY_CAPPED),
                      map((block): Block => ({ status: 'finalized', ...block })),
                      catchError((err) => {
                        log.warn(err, '[backfill] Failed to getBlock for %s (%s)', blockNumber, hash)
                        return EMPTY
                      }),
                    ),
                  MAX_CONCURRENT_BLOCK_REQUESTS,
                ),
                tap(() => {
                  count++
                  if (count % 10 === 0 || count === total) {
                    const pct = ((count / total) * 100).toFixed(1)
                    log.info('[%s] BACKFILLED block %s (%s/%s, %s%)', chainId, blockNumber, count, total, pct)
                  }
                }),
                catchError((err) => {
                  log.warn(err, '[%s] Dropping block %s due to error', chainId, blockNumber)
                  return EMPTY
                }),
              ),
            ),
          MAX_CONCURRENT_BLOCK_REQUESTS,
        ),
      ),
    ),
  )
}

/**
 * Loads the gaps file synchronously once at startup.
 * If file missing or error, cachedGapsMap stays empty.
 */
export function loadGapsFileSync(filePath?: string) {
  if (!filePath) {
    cachedGapsMap = {}
    return
  }

  try {
    const absPath = path.resolve(filePath)
    const content = fs.readFileSync(absPath, 'utf8')
    cachedGapsMap = JSON.parse(content)
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      cachedGapsMap = {}
    } else {
      throw error
    }
  }
}

export function getBackfillRangesSync(chainId: string): GapRange | null {
  return cachedGapsMap[chainId] ?? null
}

function tapError<T>(log: Logger, chainId: string, method: string) {
  return tap<T>({
    error: (e) => {
      log.warn(e, '[%s] error in backfill stream on method=%s', chainId, method)
    },
  })
}
