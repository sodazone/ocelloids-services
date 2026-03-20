import { Migrator } from 'kysely'
import { Operation } from 'rfc6902'
import { filter, Subject } from 'rxjs'
import { ControlQuery, Criteria } from '@/common/index.js'
import { maskPassword } from '@/common/url.js'
import { asPublicKey, asSerializable } from '@/common/util.js'
import { Egress } from '@/services/egress/index.js'
import { resolveDataPath } from '@/services/persistence/util.js'
import { Subscription } from '@/services/subscriptions/types.js'
import { AnyJson, Logger, NetworkURN } from '@/services/types.js'
import {
  Agent,
  AgentMetadata,
  getAgentCapabilities,
  Queryable,
  QueryPagination,
  QueryParams,
  QueryResult,
  ServerSentEventsBroadcaster,
  ServerSentEventsRequest,
  Streamable,
  Subscribable,
} from '../types.js'
import { createCrosschainBroadcaster } from './broadcaster.js'
import { fullJourneyToResponse } from './convert.js'
import { createCrosschainDatabase } from './repositories/db.js'
import { CrosschainRepository, FullJourneyResponse, ListAsset } from './repositories/index.js'
import { $XcQueryArgs, JourneyFilters, JourneyRangeFilters, XcQueryArgs } from './types/queries.js'
import { $XcServerSentEventArgs, XcServerSentEventArgs } from './types/sse.js'
import {
  $CrosschainSubscriptionInputs,
  CrosschainSubscriptionHandler,
  CrosschainSubscriptionInputs,
} from './types/subscription.js'

const ASSET_CACHE_REFRESH = 86_400_000 // 24 hours

export const CROSSCHAIN_AGENT_ID = 'crosschain'
export const DEFAULT_XC_DB_PATH = 'db.xc-explorer.sqlite'
const XC_DB_CONNECTION = process.env.OC_XC_DB_CONNECTION

/**
 * Crosschain Explorer
 *
 * Agent for indexing, querying, and streaming crosschain journeys and assets.
 * Manages persistence, migrations, and SSE broadcasting of live updates.
 */
export class CrosschainExplorer implements Agent, Queryable, Streamable, Subscribable {
  readonly #log: Logger
  readonly #repository: CrosschainRepository
  readonly #migrator: Migrator
  readonly #broadcaster: ServerSentEventsBroadcaster
  readonly #notifier: Egress
  readonly inputSchema = $CrosschainSubscriptionInputs
  readonly #subject: Subject<FullJourneyResponse>
  readonly #subs: Map<string, CrosschainSubscriptionHandler> = new Map()

  #assetCacheRefreshTask?: NodeJS.Timeout

  id = CROSSCHAIN_AGENT_ID
  streamFilterSchema = $XcServerSentEventArgs
  querySchema = $XcQueryArgs
  metadata: AgentMetadata = {
    name: 'Crosschain Agent',
    description: 'Query and streaming APIs for crosschain journeys and assets.',
    capabilities: getAgentCapabilities(this),
  }

  readonly xcTransfers$

  get repository() {
    return this.#repository
  }

  constructor({
    log,
    environment,
    egress,
    broadcaster,
  }: {
    log: Logger
    environment?: {
      dataPath?: string
    }
    egress: Egress
    broadcaster?: ServerSentEventsBroadcaster
  }) {
    this.#log = log

    const connectionString = XC_DB_CONNECTION ?? resolveDataPath(DEFAULT_XC_DB_PATH, environment?.dataPath)
    this.#log.info('[xc:explorer] database at %s', maskPassword(connectionString))
    const { db, migrator, dialect } = createCrosschainDatabase(connectionString)

    this.#migrator = migrator
    this.#repository = new CrosschainRepository(db, dialect)
    this.#broadcaster = broadcaster ?? createCrosschainBroadcaster()
    this.#notifier = egress

    this.#subject = new Subject<FullJourneyResponse>()
    this.xcTransfers$ = this.#subject.asObservable()
  }

  collectTelemetry() {
    // TODO: impl
  }

  /**
   * Emits a journey update into the internal reactive stream.
   *
   * This pushes the given {@link FullJourneyResponse} into the RxJS `Subject`,
   * making it available to all Observable-based subscribers (e.g. WebSocket
   * handlers, webhook processors, or other in-process stream consumers).
   *
   * This method is transport-agnostic and represents a domain-level event
   * emission inside the application.
   *
   * @param journey - The fully hydrated journey response to emit.
   */
  emit(journey: FullJourneyResponse) {
    this.#subject.next(journey)
  }

  async start(subs: Subscription<CrosschainSubscriptionInputs>[] = []) {
    this.#log.info('[xc:explorer] start')

    const result = await this.#migrator.migrateToLatest()

    if (result.results && result.results.length > 0) {
      this.#log.info('[xc:explorer] migration complete %o', result.results)
    }

    if (subs.length > 0) {
      this.#log.info('[agent:%s] creating stored subscriptions (%d)', this.id, subs.length)

      for (const sub of subs) {
        try {
          this.#subs.set(sub.id, this.#monitor(sub))
        } catch (error) {
          this.#log.error(error, '[agent:%s] unable to create subscription: %j', this.id, sub)
        }
      }
    }

    const latest = await this.#repository.getLatestSnapshot()

    if (!latest || Date.now() - Number(latest.snapshot_end) > ASSET_CACHE_REFRESH) {
      await this.#refreshAssetCache()
    }

    this.#assetCacheRefreshTask = setInterval(this.#refreshAssetCache.bind(this), ASSET_CACHE_REFRESH).unref()
  }

  async stop() {
    this.#log.info('[xc:explorer] stop')

    this.#broadcaster?.close()

    clearInterval(this.#assetCacheRefreshTask)

    await this.#repository.close()
  }

  query(params: QueryParams<XcQueryArgs>): Promise<QueryResult> {
    switch (params.args.op) {
      case 'journeys.list':
        return this.listJourneys(params.args.criteria, params.pagination)
      case 'journeys.by_id':
        return this.getJourneyById(params.args.criteria)
      case 'assets.list':
        return this.listAssets(params.pagination)
      case 'journeys.by_id_range':
        return this.listJourneysByRange(params.args.criteria, params.pagination)
      default:
        throw new Error('Unknown query op')
    }
  }

  subscribe(subscription: Subscription<CrosschainSubscriptionInputs>) {
    const { id } = subscription

    const handler = this.#monitor(subscription)

    this.#subs.set(id, handler)
  }

  unsubscribe(id: string) {
    try {
      const handler = this.#subs.get(id)
      if (!handler) {
        this.#log.warn('[agent:%s] unsubscribe from a non-existent subscription %s', this.id, id)
        return
      }
      handler.stream.unsubscribe()
      this.#subs.delete(id)
    } catch (error) {
      this.#log.error(error, '[agent:%s] error unsubscribing %s', this.id, id)
    }
  }

  update(subscriptionId: string, patch: Operation[]): Subscription {
    throw new Error('Update not supported')
  }

  async listAssets(pagination?: QueryPagination): Promise<QueryResult<ListAsset>> {
    return await this.#repository.listAssets(pagination)
  }

  async listJourneys(
    filters?: JourneyFilters,
    pagination?: QueryPagination,
  ): Promise<QueryResult<FullJourneyResponse>> {
    // convert address filters to public key for matching
    if (filters?.address) {
      filters.address = asPublicKey(filters.address)
    }
    const result = await this.#repository.listFullJourneys(filters, pagination)

    return {
      pageInfo: result.pageInfo,
      items: result.nodes.map(fullJourneyToResponse),
    }
  }

  async getJourneyById({ id }: { id: string }): Promise<QueryResult<FullJourneyResponse>> {
    const journey = await this.#repository.getJourneyByCorrelationId(id)
    return journey
      ? {
          items: [fullJourneyToResponse(journey)],
        }
      : { items: [] }
  }

  async listJourneysByRange(
    filters?: JourneyRangeFilters,
    pagination?: QueryPagination,
  ): Promise<QueryResult<FullJourneyResponse>> {
    const result = await this.#repository.listJourneysByRange(filters, pagination)
    return {
      pageInfo: result.pageInfo,
      items: result.nodes.map(fullJourneyToResponse),
    }
  }

  /**
   * Broadcasts a journey event to Server-Sent Events (SSE) clients.
   *
   * This sends the journey payload over the HTTP-based SSE broadcaster,
   * delivering the event to connected clients subscribed via the
   * `Streamable` interface.
   *
   * Unlike {@link emit}, this method is transport-specific and is intended
   * only for external SSE consumers.
   *
   * @param event - The SSE event type (`new_journey` or `update_journey`).
   * @param data - The fully hydrated journey response to broadcast.
   */
  broadcastJourney(event: 'new_journey' | 'update_journey', data: FullJourneyResponse) {
    this.#broadcaster.send({
      event,
      data,
    })
  }

  broadcastReplaceJourney(data: {
    ids: { id: number; correlationId: string }
    replaces: FullJourneyResponse
  }) {
    this.#broadcaster.send({
      event: 'replace_journey',
      data,
    })
  }

  onServerSentEventsRequest(request: ServerSentEventsRequest<XcServerSentEventArgs>) {
    this.#broadcaster?.stream(request)
  }

  #monitor(subscription: Subscription<CrosschainSubscriptionInputs>): CrosschainSubscriptionHandler {
    const { id, args } = subscription
    const networksControl = ControlQuery.from(this.#networkCriteria(args.networks))
    const stream = this.xcTransfers$
      .pipe(filter((journey) => networksControl.value.test(journey)))
      .subscribe({
        next: (payload) => {
          if (this.#subs.has(id)) {
            const handler = this.#subs.get(id)
            if (!handler) {
              this.#log.error(`No subscription handler found for subscription ID ${id}`)
              return
            }
            this.#notifier.publish(handler.subscription, {
              metadata: {
                type: 'xc-journeys.realtime',
                subscriptionId: id,
                agentId: this.id,
                networkId: payload.origin as NetworkURN,
                timestamp: Date.now(),
                blockTimestamp: payload.sentAt,
              },
              payload: asSerializable(payload) as unknown as AnyJson,
            })
          } else {
            // this could happen with closed ephemeral subscriptions
            this.#log.warn('[agent:%s] unable to find descriptor for subscription %s', this.id, id)
          }
        },
        complete: () => {
          if (this.#subs.has(id)) {
            const handler = this.#subs.get(id)
            if (!handler) {
              this.#log.error(`No subscription handler found for subscription ID ${id}`)
              return
            }
            if (handler.subscription.ephemeral) {
              this.#notifier.terminate(handler.subscription)
            }
          }
        },
      })

    return {
      networksControl,
      subscription,
      stream,
    }
  }

  #networkCriteria(networks: string[] | '*'): Criteria {
    if (networks === '*') {
      return {}
    }

    return {
      $or: [{ origin: { $in: networks } }, { destination: { $in: networks } }],
    }
  }

  async #refreshAssetCache() {
    try {
      await this.#repository.refreshAssetSnapshot()
      this.#log.info('[xc:explorer] asset volume cache table refreshed')
    } catch (error) {
      this.#log.error(error, '[xc:explorer] error on refreshing asset volume cache table')
    }
  }
}
