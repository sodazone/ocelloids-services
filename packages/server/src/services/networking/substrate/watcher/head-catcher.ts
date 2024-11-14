import { Observable, from, mergeMap, mergeWith, share, switchMap } from 'rxjs'

import { retryWithTruncatedExpBackoff } from '@/common/index.js'
import { HexString } from '@/services/subscriptions/types.js'
import { NetworkURN, Services } from '@/services/types.js'

import { HeadCatcher, RETRY_INFINITE } from '../../catcher.js'
import { NetworkInfo } from '../ingress/types.js'
import { Block, SubstrateApi } from '../types.js'
import { fetchers } from './fetchers.js'

/**
 * The HeadCatcher performs the following tasks ("moo" 🐮):
 * - Catches up with block headers based on the height gap for finalized blocks.
 * - Caches seen extended signed blocks and supplies them when required on finalization.
 * - Caches on-chain storage data.
 *
 * @see {HeadCatcher["finalizedBlocks"]}
 * @see {HeadCatcher.#catchUpHeads}
 */
export class SubstrateHeadCatcher extends HeadCatcher<Block> {
  readonly #apis: Record<string, SubstrateApi>
  readonly #pipes: Record<NetworkURN, Observable<Block>> = {}

  readonly chainIds: NetworkURN[]

  constructor(services: Services) {
    super(services)

    const { connector } = services

    this.#apis = connector.connect<SubstrateApi>('substrate')
    this.chainIds = (Object.keys(this.#apis) as NetworkURN[]) ?? []
  }

  /**
   * Returns an observable of extended signed blocks.
   */
  finalizedBlocks(chainId: NetworkURN): Observable<Block> {
    const pipe = this.#pipes[chainId]

    if (pipe) {
      this.log.debug('[%s] returning cached pipe', chainId)
      return pipe
    }

    const newPipe = from(this.getApi(chainId)).pipe(
      switchMap((api) => {
        return api.followHeads$.pipe(
          mergeWith(from(this.recoverRanges(chainId)).pipe(this.recoverBlockRanges(chainId, api))),
          this.tapError(chainId, 'finalizedHeads()'),
          retryWithTruncatedExpBackoff(RETRY_INFINITE),
          this.catchUpHeads(chainId, api),
          mergeMap((header) => from(api.getBlock(header.hash))),
          this.tapError(chainId, 'blockFromHeader()'),
          retryWithTruncatedExpBackoff(RETRY_INFINITE),
        )
      }),
      share(),
    )

    this.#pipes[chainId] = newPipe

    this.log.debug('[%s] created pipe', chainId)

    return newPipe
  }

  getApi(chainId: NetworkURN): Promise<SubstrateApi> {
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
    const resolvedStartKey = startKey === '0x0' ? undefined : startKey
    const at = blockHash === undefined || blockHash === '0x0' ? undefined : blockHash
    return from(this.#apis[chainId].getStorageKeys(keyPrefix, count, resolvedStartKey, at)).pipe(
      this.tapError(
        chainId,
        `state_getKeysPaged(${keyPrefix}, ${count}, ${startKey ?? 'start'}, ${blockHash ?? 'latest'})`,
      ),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
    )
  }

  getStorage(chainId: NetworkURN, storageKey: HexString, blockHash?: HexString): Observable<HexString> {
    return from(this.#apis[chainId].getStorage(storageKey, blockHash)).pipe(
      this.tapError(chainId, `state_getStorage(${storageKey}, ${blockHash ?? 'latest'})`),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
    )
  }

  async fetchNetworkInfo(chainId: NetworkURN): Promise<NetworkInfo> {
    return await fetchers.networkInfo(await this.#apis[chainId].isReady(), chainId)
  }
}
