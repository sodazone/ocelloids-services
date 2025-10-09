import { Migrator } from 'kysely'

import { asPublicKey, deepCamelize } from '@/common/util.js'
import { resolveDataPath } from '@/services/persistence/util.js'
import { Logger } from '@/services/types.js'
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
} from '../types.js'
import { createCrosschainBroadcaster } from './broadcaster.js'
import { createCrosschainDatabase } from './repositories/db.js'
import { CrosschainRepository, FullJourney, FullJourneyResponse, ListAsset } from './repositories/index.js'
import { $XcQueryArgs, JourneyFilters, XcQueryArgs } from './types/queries.js'
import { $XcServerSentEventArgs, XcServerSentEventArgs } from './types/sse.js'

const ASSET_CACHE_REFRESH = 86_400_000 // 24 hours

export const CROSSCHAIN_AGENT_ID = 'crosschain'
export const DEFAULT_XC_DB_PATH = 'db.xc-explorer.sqlite'

/**
 * Crosschain Explorer
 *
 * Agent for indexing, querying, and streaming crosschain journeys and assets.
 * Manages persistence, migrations, and SSE broadcasting of live updates.
 */
export class CrosschainExplorer implements Agent, Queryable, Streamable {
  readonly #log: Logger
  readonly #repository: CrosschainRepository
  readonly #migrator: Migrator
  readonly #broadcaster: ServerSentEventsBroadcaster

  #assetCacheRefreshTask?: NodeJS.Timeout

  id = CROSSCHAIN_AGENT_ID
  streamFilterSchema = $XcServerSentEventArgs
  querySchema = $XcQueryArgs
  metadata: AgentMetadata = {
    name: 'Crosschain Agent',
    description: 'Query and streaming APIs for crosschain journeys and assets.',
    capabilities: getAgentCapabilities(this),
  }

  get repository() {
    return this.#repository
  }

  constructor({
    log,
    environment,
    broadcaster,
  }: {
    log: Logger
    environment?: {
      dataPath?: string
    }
    broadcaster?: ServerSentEventsBroadcaster
  }) {
    this.#log = log

    const filename = resolveDataPath(DEFAULT_XC_DB_PATH, environment?.dataPath)
    this.#log.info('[xc:explorer] database at %s', filename)

    const { db, migrator } = createCrosschainDatabase(filename)
    this.#migrator = migrator
    this.#repository = new CrosschainRepository(db)
    this.#broadcaster = broadcaster ?? createCrosschainBroadcaster()
  }

  collectTelemetry() {
    // TODO: impl
  }

  async start() {
    this.#log.info('[xc:explorer] start')

    const result = await this.#migrator.migrateToLatest()

    if (result.results && result.results.length > 0) {
      this.#log.info('[xc:explorer] migration complete %o', result.results)
    }

    if ((await this.#repository.getLatestSnapshot()) === undefined) {
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
      default:
        throw new Error('Unknown query op')
    }
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
      items: result.nodes.map((journey) => deepCamelize<FullJourney>(journey)),
    }
  }

  async getJourneyById({ id }: { id: string }): Promise<QueryResult<FullJourneyResponse>> {
    const journey = await this.#repository.getJourneyByCorrelationId(id)
    return journey ? { items: [deepCamelize<FullJourney>(journey)] } : { items: [] }
  }

  broadcastJourney(event: 'new_journey' | 'update_journey', data: FullJourneyResponse) {
    this.#broadcaster.send({
      event,
      data,
    })
  }

  onServerSentEventsRequest(request: ServerSentEventsRequest<XcServerSentEventArgs>) {
    this.#broadcaster?.stream(request)
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
