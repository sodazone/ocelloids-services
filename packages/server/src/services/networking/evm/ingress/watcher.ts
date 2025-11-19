import {
  concatMap,
  defer,
  EMPTY,
  from,
  mergeAll,
  mergeMap,
  mergeWith,
  Observable,
  share,
  switchMap,
  tap,
  toArray,
} from 'rxjs'
import { MulticallParameters } from 'viem'
import { retryWithTruncatedExpBackoff } from '@/common/index.js'
import { HexString } from '@/lib.js'
import { BlockNumberRange } from '@/services/subscriptions/types.js'
import { AnyJson, NetworkURN, Services } from '@/services/types.js'
import { NeutralHeader } from '../../types.js'
import { RETRY_INFINITE, Watcher } from '../../watcher.js'
import { EvmApi } from '../client.js'
import { Block, DecodeContractParams } from '../types.js'

const BATCH_SIZE = 10
const MAX_BLOCK_DIST_FAST = 1_200

const L2_CHAINS: NetworkURN[] = ['urn:ocn:ethereum:42161', 'urn:ocn:ethereum:10', 'urn:ocn:ethereum:8453']

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
  readonly #apis: Record<string, EvmApi>
  readonly #finalized$: Record<NetworkURN, Observable<Block>> = {}
  readonly #new$: Record<NetworkURN, Observable<Block>> = {}

  readonly chainIds: NetworkURN[]

  constructor(services: Services) {
    super(services)

    const { connector } = services

    this.#apis = connector.connectAll('evm')
    this.chainIds = (Object.keys(this.#apis) as NetworkURN[]) ?? []
  }

  newBlocks(chainId: NetworkURN): Observable<Block> {
    const cachedNew$ = this.#new$[chainId]

    if (cachedNew$) {
      this.log.debug('[%s] returning cached new stream', chainId)
      return cachedNew$
    }

    const api = this.#apis[chainId]
    const new$ = api.followHeads$('new').pipe(
      this.catchUpHeads(chainId, api),
      this.handleReorgs(chainId, api),
      mergeMap((header) => api.getBlock(header.hash)),
      this.tapError(chainId, 'getBlock()'),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
      share(),
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

    if (L2_CHAINS.includes(chainId)) {
      return this.#fastFinalizedBlocks(chainId)
    }

    const api = this.#apis[chainId]
    const finalized$ = api.followHeads$('finalized').pipe(
      mergeWith(from(this.recoverRanges(chainId)).pipe(this.recoverBlockRanges(chainId, api))),
      this.tapError(chainId, 'finalizedBlocks()'),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
      this.catchUpHeads(chainId, api),
      this.handleReorgs(chainId, api),
      mergeMap((header) => from(api.getBlock(header.hash))),
      this.tapError(chainId, 'getBlock()'),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
      share({ resetOnRefCountZero: false }),
    )

    this.#finalized$[chainId] = finalized$

    this.log.debug('[%s] created finalized blocks stream', chainId)

    return finalized$
  }

  #fastFinalizedBlocks(chainId: NetworkURN): Observable<Block> {
    let count = 0
    const api = this.#apis[chainId]
    const finalized$ = api.followFastHeads$('finalized').pipe(
      this.tapError(chainId, 'followHeads()'),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
      this.#catchUpBlocks(chainId, api),
      tap((b) => {
        count++
        if (count >= 20) {
          this.log.info('[%s] FINALIZED block #%s %s (%s blocks)', chainId, b.number, b.hash, count)
          this.emit('telemetryBlockFinalized', {
            chainId,
            blockNumber: Number(b.number),
          })
          count = 0
        }
      }),
      share({ resetOnRefCountZero: false }),
    )

    this.#finalized$[chainId] = finalized$

    this.log.debug('[%s] created finalized blocks stream', chainId)

    return finalized$
  }

  watchEvents(chainId: NetworkURN, params: DecodeContractParams, eventNames?: string[]) {
    const api = this.#apis[chainId]
    return api
      .watchEvents$(params, eventNames)
      .pipe(this.tapError(chainId, 'watchEvents()'), retryWithTruncatedExpBackoff(RETRY_INFINITE))
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

  protected override recoverBlockRanges(chainId: NetworkURN, api: EvmApi) {
    return (source: Observable<BlockNumberRange[]>): Observable<NeutralHeader> => {
      const batchSize = this.batchSize(chainId)
      return source.pipe(
        mergeAll(),
        mergeMap(({ fromBlockNum, toBlockNum }) => {
          const missing: number[] = []
          for (let h = fromBlockNum; h <= toBlockNum; h++) {
            missing.push(h)
          }
          this.log.info('[%s] CATCHUP #%s - #%s', chainId, fromBlockNum, toBlockNum)

          const batches: number[][] = []
          for (let i = 0; i < missing.length; i += batchSize) {
            batches.push(missing.slice(i, i + batchSize))
          }

          return from(batches).pipe(
            mergeMap(
              (batch) =>
                from(batch).pipe(
                  mergeMap((h) => api.getNeutralBlockHeaderByNumber(h), batchSize),
                  this.tapError(chainId, 'getNeutralBlockHeaderByNumber()'),
                  retryWithTruncatedExpBackoff(RETRY_INFINITE),
                  toArray(),
                  mergeMap((blocks) => from(blocks)),
                ),
              1,
            ),
          )
        }),
      )
    }
  }

  // Fast catchup logic; directly fetches full blocks with txs by block number
  // Does not handle reorgs, used for fast L2s with centralized sequencers
  #catchUpBlocks(chainId: NetworkURN, api: EvmApi) {
    return (source: Observable<NeutralHeader>): Observable<Block> =>
      source.pipe(
        concatMap((newHead) =>
          defer(async () => {
            const tip = await this.chainTips.get(chainId)
            return tip ? Number(tip.blockNumber) : newHead.height
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
              const start =
                target - lastFetched > MAX_BLOCK_DIST_FAST ? target - MAX_BLOCK_DIST_FAST : lastFetched
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
                      mergeMap((h) => api.getBlockByNumber(h), BATCH_SIZE),
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
}
