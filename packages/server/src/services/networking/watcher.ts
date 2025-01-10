import { EventEmitter } from 'node:events'

import { Mutex } from 'async-mutex'
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  catchError,
  concatAll,
  concatMap,
  finalize,
  from,
  map,
  mergeAll,
  mergeMap,
  of,
  switchMap,
  tap,
} from 'rxjs'

import { retryWithTruncatedExpBackoff } from '@/common/index.js'
import { ServiceConfiguration } from '@/services/config.js'
import { BlockNumberRange, ChainHead } from '@/services/subscriptions/types.js'
import { TelemetryEventEmitter } from '@/services/telemetry/types.js'
import {
  AnyJson,
  Family,
  LevelDB,
  Logger,
  NetworkURN,
  Services,
  jsonEncoded,
  prefixes,
} from '@/services/types.js'
import { ApiOps, NeutralHeader } from './types.js'

// TODO: extract to config
export const RETRY_INFINITE = {
  baseDelay: 2000,
  maxDelay: 900000,
  maxCount: Infinity,
}

const _RETRY_CAPPED = {
  baseDelay: 2000,
  maxDelay: 900000,
  maxCount: 3,
}

const MAX_BLOCK_DIST: number = process.env.OC_MAX_BLOCK_DIST ? Number(process.env.OC_MAX_BLOCK_DIST) : 50 // maximum distance in #blocks
const max = (...args: number[]) => args.reduce((m, e) => (e > m ? e : m))

function arrayOfTargetHeights(newHeight: number, targetHeight: number, batchSize: number) {
  const targets = []
  let n: number = newHeight

  while (n > targetHeight) {
    if (n - targetHeight >= batchSize) {
      n -= batchSize
    } else {
      n = targetHeight
    }
    targets.push(n)
  }

  return targets
}

/**
 * The Watcher catches up with block headers based on the height gap for finalized blocks.
 *
 * @see {Watcher["finalizedBlocks"]}
 * @see {Watcher.catchUpHeads}
 */
export abstract class Watcher<T = unknown> extends (EventEmitter as new () => TelemetryEventEmitter) {
  protected readonly log: Logger

  readonly #db: LevelDB
  readonly #localConfig: ServiceConfiguration
  readonly #mutex: Record<NetworkURN, Mutex> = {}
  readonly #chainTips: Family

  constructor(services: Services) {
    super()

    const { log, localConfig, levelDB } = services

    this.log = log
    this.#localConfig = localConfig
    this.#db = levelDB
    this.#chainTips = levelDB.sublevel<string, ChainHead>(prefixes.cache.tips, jsonEncoded)
  }

  start() {
    //
  }

  stop() {
    //
  }

  /**
   * Returns the network information for a given chain.
   */
  abstract getNetworkInfo(chainId: string): Promise<AnyJson>

  /**
   * Returns the supported networks.
   */
  abstract get chainIds(): NetworkURN[]

  /**
   * Returns an observable of extended signed blocks.
   */
  abstract finalizedBlocks(chainId: NetworkURN): Observable<T>

  /**
   * Exposes the heads cache.
   */
  headsCache(chainId: NetworkURN) {
    return this.#headsFamily(chainId)
  }

  /**
   * Catches up the blockchain heads by fetching missing blocks between the current stored
   * head and the new incoming head, and updates the storage with the highest head information.
   *
   * Returns an array of heads containing the current head from the source along the heads
   * of the block range gap.
   *
   * It supports block range batching and interruption recovery. Both options are configurable
   * at the network level.
   *
   * @protected
   */
  protected catchUpHeads(chainId: NetworkURN, api: ApiOps) {
    return (source: Observable<NeutralHeader>): Observable<NeutralHeader> => {
      return source.pipe(
        tap((header) => {
          this.log.info('[%s] FINALIZED block #%s %s', chainId, header.height, header.hash)

          this.emit('telemetryBlockFinalized', {
            chainId,
            blockNumber: header.height,
          })
        }),
        mergeMap((header) =>
          from(this.#targetHeights(chainId, header)).pipe(this.#catchUpToHeight(chainId, api, header)),
        ),
        this.tapError(chainId, '#catchUpHeads()'),
        retryWithTruncatedExpBackoff(RETRY_INFINITE),
      )
    }
  }

  protected handleReorgs(chainId: NetworkURN, api: ApiOps) {
    const db = this.#headsFamily(chainId)

    // TODO signal the blocks that are rolled back, or discarded
    // and the new ones re-applied
    const rollbackOnReorg =
      (acc: NeutralHeader[] = []) =>
      async (head: NeutralHeader): Promise<NeutralHeader[]> => {
        let entries = 0
        const batch = db.batch()
        for await (const k of db.keys({
          reverse: true,
        })) {
          entries++
          // TODO: max reorg window as config
          if (entries >= 500) {
            batch.del(k)
          }
        }
        batch.put(head.height.toString(), head)
        await batch.write()

        acc.push(head)

        if (head.height === 0) {
          return acc
        }

        const prevHeight = head.height - 1
        const prevHead = await db.get(prevHeight.toString())
        // TODO handle errors, to stop...
        if (head.parenthash !== prevHead.hash) {
          const parentHead = await api.getNeutralBlockHeader(head.parenthash)
          return rollbackOnReorg(acc)(parentHead)
        }

        return acc
      }

    return (source: Observable<NeutralHeader>): Observable<NeutralHeader> =>
      source.pipe(concatMap(rollbackOnReorg()), concatAll())
  }

  protected recoverBlockRanges(chainId: NetworkURN, api: ApiOps) {
    return (source: Observable<BlockNumberRange[]>): Observable<NeutralHeader> => {
      const batchSize = this.#batchSize(chainId)
      return source.pipe(
        mergeAll(),
        mergeMap((range) => {
          return from(
            api.getBlockHash(range.fromBlockNum).then((hash) => api.getNeutralBlockHeader(hash)),
          ).pipe(
            catchError((error) => {
              this.log.warn(
                '[%s] in #recoverBlockRanges(%s-%s) %s',
                chainId,
                range.fromBlockNum,
                range.toBlockNum,
                error,
              )
              return EMPTY
            }),
            mergeMap((head) =>
              of(arrayOfTargetHeights(Number(range.fromBlockNum), Number(range.toBlockNum), batchSize)).pipe(
                this.#catchUpToHeight(chainId, api, head),
              ),
            ),
          )
        }),
      )
    }
  }

  protected async recoverRanges(chainId: NetworkURN) {
    const networkConfig = this.#localConfig.getNetwork(chainId)
    if (networkConfig && networkConfig.recovery) {
      return await (await this.#pendingRanges(chainId).values()).all()
    } else {
      return []
    }
  }

  #pendingRanges(chainId: NetworkURN) {
    return this.#db.sublevel<string, BlockNumberRange>(prefixes.cache.ranges(chainId), jsonEncoded)
  }

  async #targetHeights(chainId: NetworkURN, head: NeutralHeader) {
    if (this.#mutex[chainId] === undefined) {
      this.#mutex[chainId] = new Mutex()
    }

    const release = await this.#mutex[chainId].acquire()

    try {
      const newHeadNum = head.height
      let currentHeight: number

      const chainTip: ChainHead = {
        chainId,
        blockNumber: head.height.toString(),
        blockHash: head.hash,
        parentHash: head.parenthash,
        receivedAt: new Date(),
      }

      try {
        const currentTip = await this.#chainTips.get(chainId)
        currentHeight = Number(currentTip.blockNumber)
      } catch {
        currentHeight = newHeadNum
      }

      const blockDistance = newHeadNum - currentHeight

      if (blockDistance < 2) {
        // nothing to catch
        await this.#chainTips.put(chainId, chainTip)
        return []
      }

      const batchSize = this.#batchSize(chainId)

      // cap by distance
      const targetHeight = max(newHeadNum - MAX_BLOCK_DIST, currentHeight)

      const range: BlockNumberRange = {
        fromBlockNum: newHeadNum,
        toBlockNum: targetHeight,
      }
      const rangeKey = prefixes.cache.keys.range(range)

      // signal the range as pending
      // should be removed on complete
      await this.#pendingRanges(chainId).put(rangeKey, range)

      this.log.info('[%s] BEGIN RANGE %s', chainId, rangeKey)

      if (currentHeight < newHeadNum) {
        await this.#chainTips.put(chainId, chainTip)
      }

      return arrayOfTargetHeights(newHeadNum, targetHeight, batchSize)
    } finally {
      release()
    }
  }

  #headers(
    api: ApiOps,
    newHead: NeutralHeader,
    targetHeight: number,
    prev: NeutralHeader[],
  ): Observable<NeutralHeader[]> {
    return from(api.getNeutralBlockHeader(newHead.parenthash)).pipe(
      switchMap((header) =>
        header.height - 1 <= targetHeight
          ? of([header, ...prev])
          : this.#headers(api, header, targetHeight, [header, ...prev]),
      ),
    )
  }

  #headsFamily(chainId: NetworkURN) {
    return this.#db.sublevel<string, NeutralHeader>(prefixes.cache.family(chainId), jsonEncoded)
  }

  #catchUpToHeight(chainId: NetworkURN, api: ApiOps, newHead: NeutralHeader) {
    return (source: Observable<number[]>): Observable<NeutralHeader> => {
      return source.pipe(
        mergeMap((targets) => {
          if (targets.length === 0) {
            return of(newHead)
          }

          const batchControl = new BehaviorSubject({
            index: 0,
            target: targets[0],
            head: newHead,
            collect: [newHead],
          })

          return batchControl.pipe(
            mergeMap(({ target, head, collect }) =>
              (head.height - 1 === target ? of([head]) : this.#headers(api, head, target, collect)).pipe(
                map((heads) => {
                  if (batchControl.value.index === targets.length - 1) {
                    batchControl.complete()
                  } else {
                    const batch = batchControl.value
                    const index = batch.index + 1
                    batchControl.next({
                      index,
                      target: targets[index],
                      head: heads[0],
                      collect: [],
                    })
                  }
                  return heads
                }),
                mergeAll(),
              ),
            ),
            catchError((error) => {
              this.log.warn('[%s] in #catchUpToHeight(%s) %s', chainId, targets, error)
              return EMPTY
            }),
            tap({
              complete: async () => {
                // on complete we will clear the pending range
                const range: BlockNumberRange = {
                  fromBlockNum: newHead.height,
                  toBlockNum: batchControl.value.target,
                }
                const rangeKey = prefixes.cache.keys.range(range)

                await this.#pendingRanges(chainId).del(rangeKey)

                this.log.info('[%s] COMPLETE RANGE %s', chainId, rangeKey)
              },
            }),
            finalize(async () => {
              const fullRange: BlockNumberRange = {
                fromBlockNum: newHead.height,
                toBlockNum: targets[targets.length - 1],
              }
              const currentRange: BlockNumberRange = {
                fromBlockNum: batchControl.value.head.height,
                toBlockNum: batchControl.value.target,
              }

              const fullRangeKey = prefixes.cache.keys.range(fullRange)
              const currentRangeKey = prefixes.cache.keys.range(currentRange)

              try {
                if (fullRange.toBlockNum !== currentRange.toBlockNum) {
                  const dbBatch = this.#pendingRanges(chainId).batch()
                  await dbBatch.del(fullRangeKey).put(currentRangeKey, currentRange).write()

                  this.log.info(
                    '[%s] stale range to recover %s',
                    chainId,
                    prefixes.cache.keys.range(currentRange),
                  )
                }
              } catch (err) {
                this.log.warn('Error while writing stale ranges', err)
              }
            }),
          )
        }),
      )
    }
  }

  #batchSize(chainId: NetworkURN) {
    const networkConfig = this.#localConfig.getNetwork(chainId)
    return networkConfig?.batchSize ?? 25
  }

  protected tapError<T>(chainId: NetworkURN, method: string) {
    return tap<T>({
      error: (e) => {
        this.log.warn(e, 'error on method=%s, chain=%s', method, chainId)
        this.emit('telemetryHeadCatcherError', {
          chainId,
          method,
        })
      },
    })
  }
}
