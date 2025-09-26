import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import {
  Agent,
  AgentMetadata,
  AgentRuntimeContext,
  QueryParams,
  QueryResult,
  Queryable,
  ServerSideEventsBroadcaster,
  ServerSideEventsRequest,
  Streamable,
  getAgentCapabilities,
} from '../types.js'
import { BalancesManager } from './balances/manager.js'
import { BalanceEvents, createStewardBroadcaster } from './balances/sse.js'
import { AssetMetadataManager } from './metadata/manager.js'
import {
  $StewardQueryArgs,
  $StewardServerSideEventArgs,
  StewardQueryArgs,
  StewardServerSideEventArgs,
} from './types.js'

/**
 * The Data Steward agent.
 *
 * Aggregates and enriches cross-chain metadata for assets and currencies.
 */
export class DataSteward implements Agent, Queryable, Streamable<StewardServerSideEventArgs> {
  id = 'steward'

  querySchema = $StewardQueryArgs
  streamFilterSchema = $StewardServerSideEventArgs

  metadata: AgentMetadata = {
    name: 'Data Steward',
    description: 'Aggregates and enriches cross-chain metadata for assets and currencies.',
    capabilities: getAgentCapabilities(this),
  }

  readonly #metadataManager: AssetMetadataManager
  readonly #balancesManager: BalancesManager
  readonly #substrateIngress: SubstrateIngressConsumer
  readonly #broadcaster: ServerSideEventsBroadcaster<StewardServerSideEventArgs, BalanceEvents>

  constructor(ctx: AgentRuntimeContext) {
    const managerContext = {
      log: ctx.log,
      db: ctx.db,
      openLevelDB: ctx.openLevelDB,
      scheduler: ctx.scheduler,
      ingress: ctx.ingress,
      config: ctx.config,
    }

    this.#broadcaster = createStewardBroadcaster()
    this.#metadataManager = new AssetMetadataManager(managerContext)
    this.#balancesManager = new BalancesManager(managerContext, this.query.bind(this), this.#broadcaster)
    this.#substrateIngress = ctx.ingress.substrate
  }

  async query(params: QueryParams<StewardQueryArgs>): Promise<QueryResult> {
    // dispatch to correct manager
    const queryPaths = params.args.op.split('.')
    const queryType = queryPaths[0]
    if (queryType === 'assets' || queryType === 'chains') {
      return this.#metadataManager.queries(params)
    }
    throw new Error(`Query type ${queryType} not supported`)
  }

  onServerSideEventsRequest(request: ServerSideEventsRequest<StewardServerSideEventArgs>) {
    if (request.streamName === 'balances') {
      this.#balancesManager.onServerSideEventsRequest(request)
    } else {
      throw new Error(`SSE stream not supported: ${request.streamName}`)
    }
  }

  async stop() {
    await this.#balancesManager.stop()
    this.#metadataManager.stop()
    this.#broadcaster.close()
  }

  async start() {
    await this.#substrateIngress.isReady()
    await this.#metadataManager.start()
    await this.#balancesManager.start()
  }

  collectTelemetry() {
    // TODO: impl telemetry
  }
}
