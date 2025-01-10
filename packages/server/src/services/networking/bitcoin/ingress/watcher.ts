import { Observable, from, mergeMap, mergeWith, share } from 'rxjs'

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
  readonly #pipes: Record<NetworkURN, Observable<Block>> = {}

  readonly chainIds: NetworkURN[]

  constructor(services: Services) {
    super(services)

    const { connector } = services

    this.#apis = connector.connect('bitcoin')
    this.chainIds = (Object.keys(this.#apis) as NetworkURN[]) ?? []
  }

  finalizedBlocks(chainId: NetworkURN): Observable<Block> {
    const pipe = this.#pipes[chainId]

    if (pipe) {
      this.log.debug('[%s] returning cached pipe', chainId)
      return pipe
    }

    const api = this.#apis[chainId]
    const newPipe = api.followHeads$.pipe(
      mergeWith(from(this.recoverRanges(chainId)).pipe(this.recoverBlockRanges(chainId, api))),
      this.tapError(chainId, 'followHeads$()'),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
      this.catchUpHeads(chainId, api),
      this.handleReorgs(chainId, api),
      mergeMap((header) => from(api.getBlock(header.hash))),
      this.tapError(chainId, 'getBlock()'),
      retryWithTruncatedExpBackoff(RETRY_INFINITE),
      share(),
    )

    this.#pipes[chainId] = newPipe

    this.log.debug('[%s] created pipe', chainId)

    return newPipe
  }

  async getNetworkInfo(chainId: string) {
    return await this.#apis[chainId].getNetworkInfo()
  }
}
