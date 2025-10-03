import { Observable, share } from 'rxjs'

import { ValidationError } from '@/errors.js'
import { NetworkURN } from '@/services/types.js'

import { Finality } from '../types.js'
import { SubstrateIngressConsumer } from './ingress/types.js'
import { extractEvents, extractTxWithEvents, installOperators } from './rx/index.js'
import { Block, BlockEvent, BlockExtrinsicWithEvents } from './types.js'

export class SubstrateSharedStreams {
  static #instance: SubstrateSharedStreams
  readonly #ingress: SubstrateIngressConsumer

  readonly #blocks: Record<Finality, Record<string, Observable<Block>>>
  readonly #blockEvents: Record<Finality, Record<string, Observable<BlockEvent>>>
  readonly #blockExtrinsics: Record<Finality, Record<string, Observable<BlockExtrinsicWithEvents>>>

  private constructor(ingress: SubstrateIngressConsumer) {
    this.#ingress = ingress
    this.#blocks = {
      finalized: {},
      new: {},
    }
    this.#blockEvents = {
      finalized: {},
      new: {},
    }
    this.#blockExtrinsics = {
      finalized: {},
      new: {},
    }

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

  blocks(chainId: NetworkURN, finality: Finality = 'finalized'): Observable<Block> {
    if (!this.#blocks[finality][chainId]) {
      this.#blocks[finality][chainId] = (
        finality === 'finalized' ? this.#ingress.finalizedBlocks(chainId) : this.#ingress.newBlocks(chainId)
      ).pipe(share({ resetOnRefCountZero: false }))
    }
    return this.#blocks[finality][chainId]
  }

  blockEvents(chainId: NetworkURN, finality: Finality = 'finalized'): Observable<BlockEvent> {
    if (!this.#blockEvents[finality][chainId]) {
      this.#blockEvents[finality][chainId] = this.blocks(chainId, finality).pipe(
        extractEvents(),
        share({ resetOnRefCountZero: false }),
      )
    }
    return this.#blockEvents[finality][chainId]
  }

  blockExtrinsics(
    chainId: NetworkURN,
    finality: Finality = 'finalized',
  ): Observable<BlockExtrinsicWithEvents> {
    if (!this.#blockExtrinsics[finality][chainId]) {
      this.#blockExtrinsics[finality][chainId] = this.blocks(chainId, finality).pipe(
        extractTxWithEvents(),
        /*flattenCalls(),*/ share({ resetOnRefCountZero: false }),
      )
    }
    return this.#blockExtrinsics[finality][chainId]
  }
}
