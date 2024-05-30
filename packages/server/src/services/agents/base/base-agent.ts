import { extractEvents, extractTxWithEvents, flattenCalls, types } from '@sodazone/ocelloids-sdk'
import { Operation } from 'rfc6902'
import { Observable, from, share } from 'rxjs'
import { z } from 'zod'

import { IngressConsumer } from '../../ingress/index.js'
import { NotifierHub } from '../../notification/hub.js'
import { SubsStore } from '../../persistence/subs.js'
import { HexString, Subscription } from '../../subscriptions/types.js'
import { Logger, NetworkURN } from '../../types.js'
import { Agent, AgentId, AgentMetadata, AgentRuntimeContext } from '../types.js'
import { GetStorageAt } from '../xcm/types-augmented.js'

type SubscriptionHandler = {
  descriptor: Subscription
}

export abstract class BaseAgent<T extends SubscriptionHandler> implements Agent {
  protected readonly subs: Record<string, T>
  protected readonly log: Logger
  protected readonly timeouts: NodeJS.Timeout[]
  protected readonly db: SubsStore
  protected readonly ingress: IngressConsumer
  protected readonly notifier: NotifierHub

  protected shared: {
    blockEvents: Record<string, Observable<types.BlockEvent>>
    blockExtrinsics: Record<string, Observable<types.TxWithIdAndEvent>>
  }

  constructor(ctx: AgentRuntimeContext) {
    const { log, ingressConsumer, notifier, subsStore } = ctx

    this.log = log
    this.ingress = ingressConsumer
    this.notifier = notifier
    this.db = subsStore
    this.subs = {}
    this.timeouts = []

    this.shared = {
      blockEvents: {},
      blockExtrinsics: {},
    }
  }

  abstract get metadata(): AgentMetadata

  get id(): AgentId {
    return this.metadata.id
  }

  async getSubscriptionById(subscriptionId: string): Promise<Subscription> {
    return await this.db.getById(this.id, subscriptionId)
  }
  async getAllSubscriptions(): Promise<Subscription[]> {
    return await this.db.getByAgentId(this.id)
  }

  getSubscriptionHandler(subscriptionId: string): Subscription {
    if (this.subs[subscriptionId]) {
      return this.subs[subscriptionId].descriptor
    } else {
      throw Error('subscription not found')
    }
  }

  abstract getInputSchema(): z.ZodSchema
  abstract subscribe(subscription: Subscription): Promise<void>
  abstract unsubscribe(subscriptionId: string): Promise<void>
  abstract update(subscriptionId: string, patch: Operation[]): Promise<Subscription>
  abstract stop(): Promise<void>
  abstract start(): Promise<void>

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
