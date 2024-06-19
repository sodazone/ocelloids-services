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

import { ApiPromise } from '@polkadot/api'
import type { SignedBlockExtended } from '@polkadot/api-derive/types'
import type { Raw } from '@polkadot/types'
import type { Header } from '@polkadot/types/interfaces'

import {
  SubstrateApis,
  blockFromHeader,
  finalizedHeads,
  retryWithTruncatedExpBackoff,
} from '@sodazone/ocelloids-sdk'

import { ServiceConfiguration } from '../../config.js'
import { BlockNumberRange, ChainHead as ChainTip, HexString } from '../../subscriptions/types.js'
import { TelemetryEventEmitter } from '../../telemetry/types.js'
import { DB, Logger, NetworkURN, Services, jsonEncoded, prefixes } from '../../types.js'

import { LocalCache } from './local-cache.js'

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

const MAX_BLOCK_DIST: bigint = process.env.OC_MAX_BLOCK_DIST ? BigInt(process.env.OC_MAX_BLOCK_DIST) : 50n // maximum distance in #blocks
const max = (...args: bigint[]) => args.reduce((m, e) => (e > m ? e : m))

function arrayOfTargetHeights(newHeight: bigint, targetHeight: bigint, batchSize: bigint) {
  const targets = []
  let n: bigint = newHeight

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
 * @see {HeadCatcher.finalizedBlocks}
 * @see {HeadCatcher.#catchUpHeads}
 */
export class HeadCatcher extends (EventEmitter as new () => TelemetryEventEmitter) {
  readonly #apis: SubstrateApis
  readonly #log: Logger
  readonly #db: DB
  readonly #localConfig: ServiceConfiguration
  readonly #localCache: LocalCache

  readonly #mutex: Record<NetworkURN, Mutex> = {}
  readonly #pipes: Record<NetworkURN, Observable<any>> = {}

  constructor(services: Services) {
    super()

    const { log, localConfig, db: rootStore, connector } = services

    this.#log = log
    this.#localConfig = localConfig
    this.#apis = connector.connect()
    this.#db = rootStore
    this.#localCache = new LocalCache(this.#apis, services)
  }

  start() {
    const { networks } = this.#localConfig

    for (const network of networks) {
      // We only need to cache for smoldot
      if (network.provider.type === 'smoldot') {
        this.#localCache.watch(network)
      }
    }
  }

  stop() {
    this.#log.info('Stopping head catcher')

    this.#localCache.stop()
  }

  /**
   * Returns an observable of extended signed blocks, providing cached block content as needed.
   */
  finalizedBlocks(chainId: NetworkURN): Observable<SignedBlockExtended> {
    const apiRx = this.#apis.rx[chainId]
    const apiPromise$ = from(this.#apis.promise[chainId].isReady)
    let pipe = this.#pipes[chainId]

    if (pipe) {
      this.#log.debug('[%s] returning cached pipe', chainId)
      return pipe
    }

    if (this.#localCache.has(chainId)) {
      // only applies to light clients
      // TODO: check if can recover ranges
      pipe = apiPromise$.pipe(
        switchMap((api) =>
          apiRx.pipe(
            finalizedHeads(),
            this.#tapError(chainId, 'finalizedHeads()'),
            retryWithTruncatedExpBackoff(RETRY_INFINITE),
            this.#catchUpHeads(chainId, api),
            mergeMap((head) =>
              from(this.#localCache.getBlock(chainId, api, head.hash.toHex())).pipe(
                this.#tapError(chainId, '#getBlock()'),
                // TODO: should be configurable in the server
                retryWithTruncatedExpBackoff(RETRY_CAPPED),
                catchError((error) => {
                  this.#log.error(
                    '[%s] Unable to get block %s (#%s) %s',
                    chainId,
                    head.hash.toHex(),
                    head.number.toString(),
                    error,
                  )
                  return EMPTY
                }),
              ),
            ),
          ),
        ),
        share(),
      )
    } else {
      pipe = apiPromise$.pipe(
        switchMap((api) =>
          apiRx.pipe(
            finalizedHeads(),
            mergeWith(from(this.#recoverRanges(chainId)).pipe(this.#recoverBlockRanges(chainId, api))),
            this.#tapError(chainId, 'finalizedHeads()'),
            retryWithTruncatedExpBackoff(RETRY_INFINITE),
            this.#catchUpHeads(chainId, api),
            blockFromHeader(api),
            this.#tapError(chainId, 'blockFromHeader()'),
            retryWithTruncatedExpBackoff(RETRY_INFINITE),
          ),
        ),
        share(),
      )
    }

    this.#pipes[chainId] = pipe

    this.#log.debug('[%s] created pipe', chainId)

    return pipe
  }

  getApiPromise(chainId: NetworkURN) {
    return this.#apis.promise[chainId]
  }

  getStorage(chainId: NetworkURN, storageKey: HexString, blockHash?: HexString): Observable<Uint8Array> {
    const apiPromise$ = from(this.#apis.promise[chainId].isReady)
    const getStorage$ = apiPromise$.pipe(
      switchMap((api) => from(api.rpc.state.getStorage<Raw>(storageKey, blockHash))),
      map((data) => data.toU8a(true)),
      this.#tapError(chainId, `rpc.state.getStorage(${storageKey}, ${blockHash})`),
    )

    if (this.#localCache.has(chainId)) {
      return from(this.#localCache.getStorage(chainId, storageKey, blockHash)).pipe(
        mergeMap((data) => {
          if (data === null) {
            return getStorage$.pipe(
              retryWithTruncatedExpBackoff(RETRY_CAPPED),
              catchError((error) => {
                this.#log.error(
                  '[%s] Unable to get storage key=%s blockHash=%s',
                  chainId,
                  storageKey,
                  blockHash,
                  error,
                )
                return EMPTY
              }),
            )
          } else {
            return of(data)
          }
        }),
      )
    }

    return getStorage$.pipe(retryWithTruncatedExpBackoff(RETRY_INFINITE))
  }

  get chainIds(): NetworkURN[] {
    return this.#apis.chains as NetworkURN[]
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
  #catchUpHeads(chainId: NetworkURN, api: ApiPromise) {
    return (source: Observable<Header>): Observable<Header> => {
      return source.pipe(
        tap((header) => {
          this.#log.info(
            '[%s] FINALIZED block #%s %s',
            chainId,
            header.number.toBigInt(),
            header.hash.toHex(),
          )

          this.emit('telemetryBlockFinalized', {
            chainId,
            header,
          })
        }),
        mergeMap((header) =>
          from(this.#targetHeights(chainId, header)).pipe(this.#catchUpToHeight(chainId, api, header)),
        ),
        this.#tapError(chainId, '#catchUpHeads()'),
        retryWithTruncatedExpBackoff(RETRY_INFINITE),
      )
    }
  }

  #recoverBlockRanges(chainId: NetworkURN, api: ApiPromise) {
    return (source: Observable<BlockNumberRange[]>): Observable<Header> => {
      const batchSize = this.#batchSize(chainId)
      return source.pipe(
        mergeAll(),
        mergeMap((range) =>
          from(
            api.rpc.chain.getBlockHash(range.fromBlockNum).then((hash) => api.rpc.chain.getHeader(hash)),
          ).pipe(
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
              of(arrayOfTargetHeights(BigInt(range.fromBlockNum), BigInt(range.toBlockNum), batchSize)).pipe(
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

  async #targetHeights(chainId: NetworkURN, head: Header) {
    if (this.#mutex[chainId] === undefined) {
      this.#mutex[chainId] = new Mutex()
    }

    const release = await this.#mutex[chainId].acquire()

    try {
      const newHeadNum = head.number.toBigInt()
      let currentHeight: bigint

      const chainTip: ChainTip = {
        chainId,
        blockNumber: head.number.toString(),
        blockHash: head.hash.toHex(),
        parentHash: head.parentHash.toHex(),
        receivedAt: new Date(),
      }

      try {
        const currentTip = await this.#chainTips.get(chainId)
        currentHeight = BigInt(currentTip.blockNumber)
      } catch {
        currentHeight = newHeadNum
      }

      const blockDistance = newHeadNum - currentHeight

      if (blockDistance < 2n) {
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

  #headers(api: ApiPromise, newHead: Header, targetHeight: bigint, prev: Header[]): Observable<Header[]> {
    return from(api.rpc.chain.getHeader(newHead.parentHash)).pipe(
      switchMap((header) =>
        header.number.toBigInt() - 1n <= targetHeight
          ? of([header, ...prev])
          : this.#headers(api, header, targetHeight, [header, ...prev]),
      ),
    )
  }

  #catchUpToHeight(chainId: NetworkURN, api: ApiPromise, newHead: Header) {
    return (source: Observable<bigint[]>): Observable<Header> => {
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
              (head.number.toBigInt() - 1n === target
                ? of([head])
                : this.#headers(api, head, target, collect)
              ).pipe(
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
    return BigInt(networkConfig?.batchSize ?? 25)
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
