import { extractEvents, extractTxWithEvents, flattenCalls, types } from '@sodazone/ocelloids-sdk'
import { Observable, share } from 'rxjs'

import { IngressConsumer } from '../../ingress/index.js'
import { NetworkURN } from '../../types.js'

export class SharedStreams {
  static #instance: SharedStreams
  readonly #ingress: IngressConsumer

  readonly #blockEvents: Record<string, Observable<types.BlockEvent>>
  readonly #blockExtrinsics: Record<string, Observable<types.TxWithIdAndEvent>>

  private constructor(ingress: IngressConsumer) {
    this.#ingress = ingress
    this.#blockEvents = {}
    this.#blockExtrinsics = {}
  }

  static instance(ingress: IngressConsumer) {
    return SharedStreams.#instance ?? (SharedStreams.#instance = new SharedStreams(ingress))
  }

  blockEvents(chainId: NetworkURN): Observable<types.BlockEvent> {
    if (!this.#blockEvents[chainId]) {
      this.#blockEvents[chainId] = this.#ingress.finalizedBlocks(chainId).pipe(extractEvents(), share())
    }
    return this.#blockEvents[chainId]
  }

  blockExtrinsics(chainId: NetworkURN): Observable<types.TxWithIdAndEvent> {
    if (!this.#blockExtrinsics[chainId]) {
      this.#blockExtrinsics[chainId] = this.#ingress
        .finalizedBlocks(chainId)
        .pipe(extractTxWithEvents(), flattenCalls(), share())
    }
    return this.#blockExtrinsics[chainId]
  }
}
