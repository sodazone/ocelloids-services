import { Observable, share } from 'rxjs'

import { ValidationError } from '@/errors.js'
import { NetworkURN } from '@/services/types.js'

import { SubstrateIngressConsumer } from './ingress/types.js'
import { extractEvents, extractTxWithEvents, installOperators } from './rx/index.js'
import { BlockEvent, BlockExtrinsicWithEvents } from './types.js'

export class SubstrateSharedStreams {
  static #instance: SubstrateSharedStreams
  readonly #ingress: SubstrateIngressConsumer

  readonly #blockEvents: Record<string, Observable<BlockEvent>>
  readonly #blockExtrinsics: Record<string, Observable<BlockExtrinsicWithEvents>>

  private constructor(ingress: SubstrateIngressConsumer) {
    this.#ingress = ingress
    this.#blockEvents = {}
    this.#blockExtrinsics = {}

    installOperators()
  }

  static instance(ingress: SubstrateIngressConsumer) {
    return (
      SubstrateSharedStreams.#instance ??
      (SubstrateSharedStreams.#instance = new SubstrateSharedStreams(ingress))
    )
  }

  checkSupportedNetwork(chainId: NetworkURN) {
    if (!this.#ingress.isNetworkDefined(chainId)) {
      throw new ValidationError(`Network not supported: ${chainId}`)
    }
  }

  blockEvents(chainId: NetworkURN): Observable<BlockEvent> {
    if (!this.#blockEvents[chainId]) {
      this.#blockEvents[chainId] = this.#ingress.finalizedBlocks(chainId).pipe(extractEvents(), share())
    }
    return this.#blockEvents[chainId]
  }

  blockExtrinsics(chainId: NetworkURN): Observable<BlockExtrinsicWithEvents> {
    if (!this.#blockExtrinsics[chainId]) {
      this.#blockExtrinsics[chainId] = this.#ingress
        .finalizedBlocks(chainId)
        .pipe(extractTxWithEvents(), /*flattenCalls(),*/ share())
    }
    return this.#blockExtrinsics[chainId]
  }
}
