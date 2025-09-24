import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import {
  Agent,
  AgentMetadata,
  AgentRuntimeContext,
  QueryParams,
  QueryResult,
  Queryable,
  ServerSideEvent,
  ServerSideEventsBroadcaster,
  ServerSideEventsRequest,
  Streamable,
  getAgentCapabilities,
} from '../types.js'
import { BalancesManager } from './balances/manager.js'
import { createStewardBroadcaster } from './balances/sse.js'
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
  readonly #broadcaster: ServerSideEventsBroadcaster<StewardServerSideEventArgs>

  constructor(ctx: AgentRuntimeContext) {
    const managerContext = {
      log: ctx.log,
      db: ctx.db,
      openLevelDB: ctx.openLevelDB,
      scheduler: ctx.scheduler,
      ingress: ctx.ingress,
      config: ctx.config,
    }
    this.#metadataManager = new AssetMetadataManager(managerContext)
    this.#balancesManager = new BalancesManager(
      managerContext,
      this.query.bind(this),
      this.broadcast.bind(this),
    )
    this.#substrateIngress = ctx.ingress.substrate
    this.#broadcaster = createStewardBroadcaster()
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

  broadcast(event: ServerSideEvent) {
    this.#broadcaster.send(event)
  }

  onServerSideEventsRequest(request: ServerSideEventsRequest<StewardServerSideEventArgs>) {
    this.#broadcaster.stream(request)
  }

  async stop() {
    this.#metadataManager.stop()
    // balances manager stop
    await this.#balancesManager.stop()
    this.#broadcaster.close()
  }

  async start() {
    await this.#substrateIngress.isReady()

    await this.#metadataManager.start()
    // balances manager start
    await this.#balancesManager.start()
  }

  collectTelemetry() {
    // TODO: impl telemetry
  }
}
