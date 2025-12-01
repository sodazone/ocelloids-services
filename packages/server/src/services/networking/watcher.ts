import { EventEmitter } from 'node:events'

import { Mutex } from 'async-mutex'
import {
  BehaviorSubject,
  catchError,
  concatMap,
  defer,
  EMPTY,
  from,
  lastValueFrom,
  map,
  mergeAll,
  mergeMap,
  Observable,
  of,
  tap,
} from 'rxjs'

import { retryWithTruncatedExpBackoff } from '@/common/index.js'
import { ServiceConfiguration } from '@/services/config.js'
import { BlockNumberRange, ChainHead } from '@/services/subscriptions/types.js'
import { TelemetryEventEmitter } from '@/services/telemetry/types.js'
import {
  AnyJson,
  Family,
  jsonEncoded,
  LevelDB,
  Logger,
  NetworkURN,
  prefixes,
  Services,
} from '@/services/types.js'
import { ApiOps, NeutralHeader } from './types.js'

// TODO: extract to config
export const RETRY_INFINITE = {
  baseDelay: 2000,
  maxDelay: 900000,
  maxCount: Infinity,
}

export const RETRY_ONCE = {
  baseDelay: 2000,
  maxDelay: 900000,
  maxCount: 1,
}

export const retryCapped = (cap: number) => ({
  baseDelay: 2000,
  maxDelay: 900000,
  maxCount: cap,
})

const MAX_REORG = 500

const MAX_BLOCK_DIST: number = process.env.OC_MAX_BLOCK_DIST ? Number(process.env.OC_MAX_BLOCK_DIST) : 50 // maximum distance in #blocks
const max = (...args: number[]) => args.reduce((m, e) => (e > m ? e : m))
const heightKey = (h: number) => h.toString().padStart(20, '0')

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
 * @see {Watcher["catchUpHeads"]}
 */
export abstract class Watcher<T = unknown> extends (EventEmitter as new () => TelemetryEventEmitter) {
  protected readonly log: Logger

  readonly #db: LevelDB
  readonly #localConfig: ServiceConfiguration
  readonly #mutex: Record<NetworkURN, Mutex> = {}
  readonly #chainTips: Family<string, ChainHead>

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

  async stop() {
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
   * Returns an observable of finalized blocks.
   */
  abstract finalizedBlocks(chainId: NetworkURN): Observable<T>

  /**
   * Returns an observable of new blocks.
   */
  abstract newBlocks(chainId: NetworkURN): Observable<T>

  /**
   * Exposes the heads cache.
   */
  headsCache(chainId: NetworkURN) {
    return this.#headsFamily(chainId)
  }

  protected get chainTips(): Family<string, ChainHead> {
    return this.#chainTips
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
    const lastEmitted: Record<number, string> = {}

    const rollbackOnReorg = (head: NeutralHeader): Observable<NeutralHeader> =>
      defer(async () => {
        if (lastEmitted[head.height] === head.hash) {
          // already processed
          return []
        }

        await db.put(heightKey(head.height), head)
        lastEmitted[head.height] = head.hash

        const pruneBelow = head.height - MAX_REORG

        // prune cache
        for (const h of Object.keys(lastEmitted)) {
          if (Number(h) < pruneBelow) {
            delete lastEmitted[Number(h)]
          }
        }

        // prune db
        const pruneKey = heightKey(pruneBelow)
        const batch = db.batch()
        for await (const [key] of db.iterator({ lt: pruneKey })) {
          batch.del(key)
        }
        if (batch.length > 0) {
          await batch.write()
        }

        const emits: NeutralHeader[] = [head]

        // check for reorg
        if (head.height > 0) {
          const prevHeight = head.height - 1
          const prevHead = await db.get(heightKey(prevHeight))

          if (prevHead !== undefined && head.parenthash !== prevHead.hash) {
            this.log.info('[%s] reorg at height %s', chainId, head.height)

            // fetch missing parent
            const parentHead = await api.getNeutralBlockHeader(head.parenthash)

            // recurse, collect its emissions
            const parentEmits = await lastValueFrom(rollbackOnReorg(parentHead))

            // prepend parent emissions so they flow before this head
            if (Array.isArray(parentEmits)) {
              emits.unshift(...parentEmits)
            } else {
              emits.unshift(parentEmits)
            }
          }
        }

        return emits
      }).pipe(concatMap((emits) => (Array.isArray(emits) ? emits : [emits])))

    return (source: Observable<NeutralHeader>): Observable<NeutralHeader> =>
      source.pipe(concatMap(rollbackOnReorg))
  }

  protected recoverBlockRanges(chainId: NetworkURN, api: ApiOps) {
    return (source: Observable<BlockNumberRange[]>): Observable<NeutralHeader> => {
      const batchSize = this.batchSize(chainId)
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
      return await this.pendingRanges(chainId).values().all()
    } else {
      return []
    }
  }

  protected pendingRanges(chainId: NetworkURN) {
    return this.#db.sublevel<string, BlockNumberRange>(prefixes.cache.ranges(chainId), jsonEncoded)
  }

  async #targetHeights(chainId: NetworkURN, head: NeutralHeader) {
    if (this.#mutex[chainId] === undefined) {
      this.#mutex[chainId] = new Mutex()
    }

    const release = await this.#mutex[chainId].acquire()

    try {
      const newHeadNum = head.height

      const chainTip: ChainHead = {
        chainId,
        blockNumber: head.height.toString(),
        blockHash: head.hash,
        parentHash: head.parenthash,
        receivedAt: new Date(),
      }

      const currentTip = await this.#chainTips.get(chainId)
      const currentHeight = currentTip === undefined ? newHeadNum : Number(currentTip.blockNumber)

      const blockDistance = newHeadNum - currentHeight

      if (blockDistance < 0) {
        return []
      }

      if (blockDistance < 2) {
        // nothing to catch
        await this.#chainTips.put(chainId, chainTip)
        return []
      }

      const batchSize = this.batchSize(chainId)

      // cap by distance
      const targetHeight = max(newHeadNum - this.maxBlockDist(chainId), currentHeight)

      const range: BlockNumberRange = {
        fromBlockNum: newHeadNum,
        toBlockNum: targetHeight,
      }
      const rangeKey = prefixes.cache.keys.range(range)

      // signal the range as pending
      // should be removed on complete
      await this.pendingRanges(chainId).put(rangeKey, range)

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
      concatMap((header) =>
        header.height <= targetHeight
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
              (head.height === target ? of([head]) : this.#headers(api, head, target, collect)).pipe(
                map((heads) => {
                  if (batchControl.value.index === targets.length - 1) {
                    this.log.info('[%s] CATCHUP Final block emitted #%s', chainId, heads[0].height)
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

                await this.pendingRanges(chainId).del(rangeKey)

                this.log.info('[%s] COMPLETE RANGE %s', chainId, rangeKey)

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
                    const dbBatch = this.pendingRanges(chainId).batch()
                    await dbBatch.del(fullRangeKey).put(currentRangeKey, currentRange).write()

                    this.log.info(
                      '[%s] stale range to recover %s',
                      chainId,
                      prefixes.cache.keys.range(currentRange),
                    )
                  }
                } catch (err) {
                  this.log.warn(err, 'Error while writing stale ranges')
                }
              },
            }),
          )
        }),
      )
    }
  }

  protected batchSize(chainId: NetworkURN) {
    const networkConfig = this.#localConfig.getNetwork(chainId)
    return networkConfig?.batchSize ?? 25
  }

  protected maxBlockDist(chainId: NetworkURN) {
    const networkConfig = this.#localConfig.getNetwork(chainId)
    return networkConfig?.maxBlockDist ?? MAX_BLOCK_DIST
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
