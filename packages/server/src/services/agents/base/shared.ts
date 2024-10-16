import { Observable, share } from 'rxjs'

import { IngressConsumer } from '@/services/ingress/index.js'
import { BlockEvent, extractEvents } from '@/services/networking/operators/extract.js'
import { NetworkURN } from '@/services/types.js'

export class SharedStreams {
  static #instance: SharedStreams
  readonly #ingress: IngressConsumer

  readonly #blockEvents: Record<string, Observable<BlockEvent>>
  // readonly #blockExtrinsics: Record<string, Observable<BlockExtrinsic>>

  private constructor(ingress: IngressConsumer) {
    this.#ingress = ingress
    this.#blockEvents = {}
    //this.#blockExtrinsics = {}
  }

  static instance(ingress: IngressConsumer) {
    return SharedStreams.#instance ?? (SharedStreams.#instance = new SharedStreams(ingress))
  }

  blockEvents(chainId: NetworkURN): Observable<BlockEvent> {
    if (!this.#blockEvents[chainId]) {
      this.#blockEvents[chainId] = this.#ingress.finalizedBlocks(chainId).pipe(extractEvents(), share())
    }
    return this.#blockEvents[chainId]
  }

  /*
  blockExtrinsics(chainId: NetworkURN): Observable<BlockExtrinsic> {
    if (!this.#blockExtrinsics[chainId]) {
      this.#blockExtrinsics[chainId] = this.#ingress
        .finalizedBlocks(chainId)
        .pipe(extractTxWithEvents(), flattenCalls(), share())
    }
    return this.#blockExtrinsics[chainId]
  }*/
}
