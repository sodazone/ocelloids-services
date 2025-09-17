import { Observable, from, mergeMap, mergeWith, share } from 'rxjs'

import { retryWithTruncatedExpBackoff } from '@/common/index.js'
import { AnyJson, NetworkURN, Services } from '@/services/types.js'

import { RETRY_INFINITE, Watcher } from '../../watcher.js'
import { EvmApi } from '../client.js'
import { BlockWithLogs } from '../types.js'

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
export class EvmWatcher extends Watcher<BlockWithLogs> {
  readonly #apis: Record<string, EvmApi>
  readonly #finalized$: Record<NetworkURN, Observable<BlockWithLogs>> = {}
  readonly #new$: Record<NetworkURN, Observable<BlockWithLogs>> = {}

  readonly chainIds: NetworkURN[]

  constructor(services: Services) {
    super(services)

    const { connector } = services

    this.#apis = connector.connectAll('evm')
    this.chainIds = (Object.keys(this.#apis) as NetworkURN[]) ?? []
  }

  newBlocks(chainId: NetworkURN): Observable<BlockWithLogs> {
    const cachedNew$ = this.#new$[chainId]

    if (cachedNew$) {
      this.log.debug('[%s] returning cached new stream', chainId)
      return cachedNew$
    }

    const api = this.#apis[chainId]
    const new$ = api.followHeads$('new').pipe(
      this.catchUpHeads(chainId, api),
      this.handleReorgs(chainId, api),
      mergeMap((header) => api.getBlockWithLogs(header.hash)),
      this.tapError(chainId, 'getBlock()'),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
      share(),
    )
    this.#new$[chainId] = new$

    this.log.debug('[%s] created new blocks stream', chainId)

    return new$
  }

  finalizedBlocks(chainId: NetworkURN): Observable<BlockWithLogs> {
    const cachedFinalized$ = this.#finalized$[chainId]

    if (cachedFinalized$) {
      this.log.debug('[%s] returning cached finalized stream', chainId)
      return cachedFinalized$
    }

    const api = this.#apis[chainId]
    const finalized$ = api.followHeads$('finalized').pipe(
      mergeWith(from(this.recoverRanges(chainId)).pipe(this.recoverBlockRanges(chainId, api))),
      this.tapError(chainId, 'finalizedBlocks()'),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
      this.catchUpHeads(chainId, api),
      this.handleReorgs(chainId, api),
      mergeMap((header) => from(api.getBlockWithLogs(header.hash))),
      this.tapError(chainId, 'getBlock()'),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
      share(),
    )

    this.#finalized$[chainId] = finalized$

    this.log.debug('[%s] created finalized blocks stream', chainId)

    return finalized$
  }

  getNetworkInfo(chainId: string): Promise<AnyJson> {
    const chain = this.#apis[chainId].getNetworkInfo()
    return Promise.resolve(chain as unknown as AnyJson)
  }
}
