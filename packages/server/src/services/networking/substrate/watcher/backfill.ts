import fs from 'fs'
import path from 'path'

import { Observable, from, range } from 'rxjs'
import { concatMap, map, switchMap, tap } from 'rxjs/operators'

import { Logger } from '@/services/types.js'
import { BlockStatus } from '../../types.js'
import { Block, SubstrateApi } from '../types.js'

type GapRange = [number, number]
type GapsMap = Record<string, GapRange>

let cachedGapsMap: GapsMap = {}

export function backfillBlocks$(
  log: Logger,
  {
    api$,
    start,
    end,
    chainId,
  }: { api$: Observable<SubstrateApi>; chainId: string; start: number; end: number },
): Observable<Block> {
  const total = end - start + 1
  let count = 0

  log.info('[%s] backfilling stream %s-%s', chainId, start, end)

  return api$.pipe(
    switchMap((api) =>
      range(start, total).pipe(
        concatMap((blockNumber) =>
          from(api.getBlockHash(blockNumber)).pipe(
            concatMap((hash) =>
              from(api.getBlock(hash)).pipe(
                map(
                  (block): Block => ({
                    status: 'finalized' as BlockStatus,
                    ...block,
                  }),
                ),
              ),
            ),
            tap(() => {
              count++
              if (count % 10 === 0 || count === total) {
                const pct = ((count / total) * 100).toFixed(1)
                log.info('[%s] backfilling block %s (%s/%s, %s%)', chainId, blockNumber, count, total, pct)
              }
            }),
          ),
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
