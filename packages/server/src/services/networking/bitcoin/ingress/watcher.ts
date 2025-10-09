import { from, mergeMap, mergeWith, Observable, share } from 'rxjs'

import { retryWithTruncatedExpBackoff } from '@/common/index.js'
import { NetworkURN, Services } from '@/services/types.js'

import { RETRY_INFINITE, Watcher } from '../../watcher.js'
import { BitcoinApi } from '../client.js'
import { Block } from '../types.js'

/**
 * Bitcoin Watcher
 */
export class BitcoinWatcher extends Watcher<Block> {
  readonly #apis: Record<string, BitcoinApi>
  readonly #finalized$: Record<NetworkURN, Observable<Block>> = {}

  readonly chainIds: NetworkURN[]

  constructor(services: Services) {
    super(services)

    const { connector } = services

    this.#apis = connector.connectAll('bitcoin')
    this.chainIds = (Object.keys(this.#apis) as NetworkURN[]) ?? []
  }

  // TODO: it's already best block, finalized will be
  // by configurable number of confirmations.
  newBlocks(_chainId: NetworkURN): Observable<Block> {
    throw new Error('Method not implemented.')
  }

  finalizedBlocks(chainId: NetworkURN): Observable<Block> {
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
      mergeMap((header) => from(api.getBlock(header.hash))),
      this.tapError(chainId, 'getBlock()'),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
      share(),
    )

    this.#finalized$[chainId] = finalized$

    this.log.debug('[%s] created finalized stream', chainId)

    return finalized$
  }

  async getNetworkInfo(chainId: string) {
    return await this.#apis[chainId].getNetworkInfo()
  }
}
