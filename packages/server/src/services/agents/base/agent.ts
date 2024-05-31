import { extractEvents, extractTxWithEvents, flattenCalls, types } from '@sodazone/ocelloids-sdk'
import { Operation } from 'rfc6902'
import { Observable, from, share } from 'rxjs'
import { z } from 'zod'

import { IngressConsumer } from '../../ingress/index.js'
import { HexString, Subscription } from '../../subscriptions/types.js'
import { Logger, NetworkURN } from '../../types.js'
import { Agent, AgentId, AgentMetadata, AgentRuntimeContext, SubscriptionHandler } from '../types.js'
import { GetStorageAt } from '../xcm/types-augmented.js'

export abstract class BaseAgent<T extends SubscriptionHandler = SubscriptionHandler> implements Agent<T> {
  protected readonly log: Logger

  protected readonly subs: Record<string, T>
  protected readonly ingress: IngressConsumer
  protected readonly shared: {
    blockEvents: Record<string, Observable<types.BlockEvent>>
    blockExtrinsics: Record<string, Observable<types.TxWithIdAndEvent>>
  }

  constructor(ctx: AgentRuntimeContext) {
    const { log, ingressConsumer } = ctx

    this.log = log
    this.ingress = ingressConsumer
    this.subs = {}

    this.shared = {
      blockEvents: {},
      blockExtrinsics: {},
    }
  }

  abstract get metadata(): AgentMetadata

  get id(): AgentId {
    return this.metadata.id
  }

  getSubscriptionDescriptor(subscriptionId: string): Subscription {
    return this.getSubscriptionHandler(subscriptionId).descriptor
  }

  getSubscriptionHandler(subscriptionId: string): T {
    if (this.subs[subscriptionId]) {
      return this.subs[subscriptionId]
    } else {
      throw Error('subscription not found')
    }
  }

  abstract get inputSchema(): z.ZodSchema

  abstract subscribe(subscription: Subscription): Promise<void>
  abstract unsubscribe(subscriptionId: string): Promise<void>

  abstract update(subscriptionId: string, patch: Operation[]): Promise<Subscription>
  abstract stop(): Promise<void>
  abstract start(subs: Subscription[]): Promise<void>

  collectTelemetry() {
    /* no telemetry */
  }

  protected sharedBlockEvents(chainId: NetworkURN): Observable<types.BlockEvent> {
    if (!this.shared.blockEvents[chainId]) {
      this.shared.blockEvents[chainId] = this.ingress.finalizedBlocks(chainId).pipe(extractEvents(), share())
    }
    return this.shared.blockEvents[chainId]
  }

  protected sharedBlockExtrinsics(chainId: NetworkURN): Observable<types.TxWithIdAndEvent> {
    if (!this.shared.blockExtrinsics[chainId]) {
      this.shared.blockExtrinsics[chainId] = this.ingress
        .finalizedBlocks(chainId)
        .pipe(extractTxWithEvents(), flattenCalls(), share())
    }
    return this.shared.blockExtrinsics[chainId]
  }

  protected getStorageAt(chainId: NetworkURN): GetStorageAt {
    return (blockHash: HexString, key: HexString) => {
      return from(this.ingress.getStorage(chainId, key, blockHash))
    }
  }
}
