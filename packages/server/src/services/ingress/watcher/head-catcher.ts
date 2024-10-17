import { EventEmitter } from 'node:events'

import { Mutex } from 'async-mutex'
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  catchError,
  finalize,
  from,
  map,
  mergeAll,
  mergeMap,
  mergeWith,
  of,
  share,
  switchMap,
  tap,
} from 'rxjs'

import { BlockInfo } from '@polkadot-api/observable-client'

import { ServiceConfiguration } from '@/services/config.js'
import { ApiClient, Block, retryWithTruncatedExpBackoff } from '@/services/networking/index.js'
import { BlockNumberRange, ChainHead as ChainTip, HexString } from '@/services/subscriptions/types.js'
import { TelemetryEventEmitter } from '@/services/telemetry/types.js'
import { LevelDB, Logger, NetworkURN, Services, jsonEncoded, prefixes } from '@/services/types.js'

import { NetworkInfo } from '../index.js'
import { fetchers } from './fetchers.js'

// TODO: extract to config
export const RETRY_INFINITE = {
  baseDelay: 2000,
  maxDelay: 900000,
  maxCount: Infinity,
}

const RETRY_CAPPED = {
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
 * The HeadCatcher performs the following tasks ("moo" 🐮):
 * - Catches up with block headers based on the height gap for finalized blocks.
 * - Caches seen extended signed blocks and supplies them when required on finalization.
 * - Caches on-chain storage data.
 *
 * @see {HeadCatcher["finalizedBlocks"]}
 * @see {HeadCatcher.#catchUpHeads}
 */
export class HeadCatcher extends (EventEmitter as new () => TelemetryEventEmitter) {
  readonly #apis: Record<string, ApiClient>
  readonly #log: Logger
  readonly #db: LevelDB
  readonly #localConfig: ServiceConfiguration

  readonly #mutex: Record<NetworkURN, Mutex> = {}
  readonly #pipes: Record<NetworkURN, Observable<Block>> = {}

  constructor(services: Services) {
    super()

    const { log, localConfig, levelDB: rootStore, connector } = services

    this.#log = log
    this.#localConfig = localConfig
    this.#apis = connector.connect()
    this.#db = rootStore
  }

  start() {
    //
  }

  stop() {
    //
  }

  /**
   * Returns an observable of extended signed blocks, providing cached block content as needed.
   */
  finalizedBlocks(chainId: NetworkURN): Observable<Block> {
    const api = this.#apis[chainId]
    let pipe = this.#pipes[chainId]

    if (pipe) {
      this.#log.debug('[%s] returning cached pipe', chainId)
      return pipe
    }

    pipe = api.finalizedHeads$.pipe(
      mergeWith(from(this.#recoverRanges(chainId)).pipe(this.#recoverBlockRanges(chainId, api))),
      this.#tapError(chainId, 'finalizedHeads()'),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
      this.#catchUpHeads(chainId, api),
      mergeMap((header) => from(api.getBlock(header))),
      this.#tapError(chainId, 'blockFromHeader()'),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
      share(),
    )

    this.#pipes[chainId] = pipe

    this.#log.debug('[%s] created pipe', chainId)

    return pipe
  }

  getApi(chainId: NetworkURN): Promise<ApiClient> {
    return this.#apis[chainId].isReady()
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
    // TODO log errors and handle retry
    const resolvedStartKey = startKey === '0x0' ? undefined : startKey
    const at = blockHash === undefined || blockHash === '0x0' ? undefined : blockHash
    return from(this.#apis[chainId].getStorageKeys(keyPrefix, count, resolvedStartKey, at))

    /*
    const api$ = from(this.#apis.promise[chainId].isReady)
    const resolvedStartKey = startKey === '0x0' ? undefined : startKey
    const getStorageKeys$ = apiPromise$.pipe(
      switchMap((api) =>
        from(
          blockHash === undefined || blockHash === '0x0'
            ? api.rpc.state.getKeysPaged(keyPrefix, count, resolvedStartKey)
            : api.rpc.state.getKeysPaged(keyPrefix, count, resolvedStartKey, blockHash),
        ),
      ),
      map((data) =>
        data.toArray().map((storageKey) => {
          return storageKey.toHex()
        }),
      ),
      this.#tapError(
        chainId,
        `rpc.state.getKeysPaged(${keyPrefix}, ${count}, ${startKey ?? 'start'}, ${blockHash ?? 'latest'})`,
      ),
    )

    return getStorageKeys$.pipe(retryWithTruncatedExpBackoff(RETRY_INFINITE))
    */
  }

  getStorage(chainId: NetworkURN, storageKey: HexString, blockHash?: HexString): Observable<HexString> {
    return from(this.#apis[chainId].getStorage(storageKey, blockHash))

    /*
    const apiPromise$ = from(this.#apis.promise[chainId].isReady)
    const getStorage$ = apiPromise$.pipe(
      switchMap((api) =>
        from(
          blockHash === undefined || blockHash === '0x0'
            ? api.rpc.state.getStorage<Raw>(storageKey)
            : api.rpc.state.getStorage<Raw>(storageKey, blockHash),
        ),
      ),
      map((data) => data.toU8a(true)),
      this.#tapError(chainId, `rpc.state.getStorage(${storageKey}, ${blockHash ?? 'latest'})`),
    )

    return getStorage$.pipe(retryWithTruncatedExpBackoff(RETRY_INFINITE))
    */
  }

  get chainIds(): NetworkURN[] {
    return Object.keys(this.#apis) as NetworkURN[]
  }

  async fetchNetworkInfo(chainId: NetworkURN): Promise<NetworkInfo> {
    return await fetchers.networkInfo(this.#apis[chainId], chainId)
  }

  get #chainTips() {
    return this.#db.sublevel<string, ChainTip>(prefixes.cache.tips, jsonEncoded)
  }

  #pendingRanges(chainId: NetworkURN) {
    return this.#db.sublevel<string, BlockNumberRange>(prefixes.cache.ranges(chainId), jsonEncoded)
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
   * @private
   */
  #catchUpHeads(chainId: NetworkURN, api: ApiClient) {
    return (source: Observable<BlockInfo>): Observable<BlockInfo> => {
      return source.pipe(
        tap((header) => {
          this.#log.info('[%s] FINALIZED block #%s %s', chainId, header.number, header.hash)

          // TODO change type in emit event
          /*this.emit('telemetryBlockFinalized', {
            chainId,
            header,
          })*/
        }),
        mergeMap((header) =>
          from(this.#targetHeights(chainId, header)).pipe(this.#catchUpToHeight(chainId, api, header)),
        ),
        this.#tapError(chainId, '#catchUpHeads()'),
        retryWithTruncatedExpBackoff(RETRY_INFINITE),
      )
    }
  }

  #recoverBlockRanges(chainId: NetworkURN, api: ApiClient) {
    return (source: Observable<BlockNumberRange[]>): Observable<BlockInfo> => {
      const batchSize = this.#batchSize(chainId)
      return source.pipe(
        mergeAll(),
        mergeMap((range) =>
          from(api.getBlockHash(range.fromBlockNum).then((hash) => api.getHeader(hash))).pipe(
            catchError((error) => {
              this.#log.warn(
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
          ),
        ),
      )
    }
  }

  async #recoverRanges(chainId: NetworkURN) {
    const networkConfig = this.#localConfig.networks.find((n) => n.id === chainId)
    if (networkConfig && networkConfig.recovery) {
      return await (await this.#pendingRanges(chainId).values()).all()
    } else {
      return []
    }
  }

  async #targetHeights(chainId: NetworkURN, head: BlockInfo) {
    if (this.#mutex[chainId] === undefined) {
      this.#mutex[chainId] = new Mutex()
    }

    const release = await this.#mutex[chainId].acquire()

    try {
      const newHeadNum = head.number
      let currentHeight: number

      const chainTip: ChainTip = {
        chainId,
        blockNumber: head.number.toString(),
        blockHash: head.hash,
        parentHash: head.parent,
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
        fromBlockNum: newHeadNum.toString(),
        toBlockNum: targetHeight.toString(),
      }
      const rangeKey = prefixes.cache.keys.range(range)

      // signal the range as pending
      // should be removed on complete
      await this.#pendingRanges(chainId).put(rangeKey, range)

      this.#log.info('[%s] BEGIN RANGE %s', chainId, rangeKey)

      if (currentHeight < newHeadNum) {
        await this.#chainTips.put(chainId, chainTip)
      }

      return arrayOfTargetHeights(newHeadNum, targetHeight, batchSize)
    } finally {
      release()
    }
  }

  #headers(
    api: ApiClient,
    newHead: BlockInfo,
    targetHeight: number,
    prev: BlockInfo[],
  ): Observable<BlockInfo[]> {
    return from(api.getHeader(newHead.parent)).pipe(
      switchMap((header) =>
        header.number - 1 <= targetHeight
          ? of([header, ...prev])
          : this.#headers(api, header, targetHeight, [header, ...prev]),
      ),
    )
  }

  #catchUpToHeight(chainId: NetworkURN, api: ApiClient, newHead: BlockInfo) {
    return (source: Observable<number[]>): Observable<BlockInfo> => {
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
              (head.number - 1 === target ? of([head]) : this.#headers(api, head, target, collect)).pipe(
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
              this.#log.warn('[%s] in #catchUpToHeight(%s) %s', chainId, targets, error)
              return EMPTY
            }),
            tap({
              complete: async () => {
                // on complete we will clear the pending range
                const range: BlockNumberRange = {
                  fromBlockNum: newHead.number.toString(),
                  toBlockNum: batchControl.value.target.toString(),
                }
                const rangeKey = prefixes.cache.keys.range(range)

                await this.#pendingRanges(chainId).del(rangeKey)

                this.#log.info('[%s] COMPLETE RANGE %s', chainId, rangeKey)
              },
            }),
            finalize(async () => {
              const fullRange: BlockNumberRange = {
                fromBlockNum: newHead.number.toString(),
                toBlockNum: targets[targets.length - 1].toString(),
              }
              const currentRange: BlockNumberRange = {
                fromBlockNum: batchControl.value.head.number.toString(),
                toBlockNum: batchControl.value.target.toString(),
              }

              const fullRangeKey = prefixes.cache.keys.range(fullRange)
              const currentRangeKey = prefixes.cache.keys.range(currentRange)

              try {
                if (fullRange.toBlockNum !== currentRange.toBlockNum) {
                  const dbBatch = this.#pendingRanges(chainId).batch()
                  await dbBatch.del(fullRangeKey).put(currentRangeKey, currentRange).write()

                  this.#log.info(
                    '[%s] stale range to recover %s',
                    chainId,
                    prefixes.cache.keys.range(currentRange),
                  )
                }
              } catch (err) {
                this.#log.warn('Error while writing stale ranges', err)
              }
            }),
          )
        }),
      )
    }
  }

  #batchSize(chainId: NetworkURN) {
    const networkConfig = this.#localConfig.networks.find((n) => n.id === chainId)
    return networkConfig?.batchSize ?? 25
  }

  #tapError<T>(chainId: NetworkURN, method: string) {
    return tap<T>({
      error: (e) => {
        this.#log.warn(e, 'error on method=%s, chain=%s', method, chainId)
        this.emit('telemetryHeadCatcherError', {
          chainId,
          method,
        })
      },
    })
  }
}
