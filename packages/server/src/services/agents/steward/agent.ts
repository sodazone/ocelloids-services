import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'

import {
  Agent,
  AgentMetadata,
  AgentRuntimeContext,
  QueryParams,
  QueryResult,
  Queryable,
  getAgentCapabilities,
} from '../types.js'
import { BalancesManager } from './balances/manager.js'
import { AssetMetadataManager } from './metadata/manager.js'
import { $StewardQueryArgs, StewardQueryArgs } from './types.js'

/**
 * The Data Steward agent.
 *
 * Aggregates and enriches cross-chain metadata for assets and currencies.
 */
export class DataSteward implements Agent, Queryable {
  id = 'steward'

  querySchema = $StewardQueryArgs

  metadata: AgentMetadata = {
    name: 'Data Steward',
    description: 'Aggregates and enriches cross-chain metadata for assets and currencies.',
    capabilities: getAgentCapabilities(this),
  }

  readonly #metadataManager: AssetMetadataManager
  readonly #balancesManager: BalancesManager
  readonly #substrateIngress: SubstrateIngressConsumer

  constructor(ctx: AgentRuntimeContext) {
    const managerContext = {
      log: ctx.log,
      db: ctx.db,
      openLevelDB: ctx.openLevelDB,
      scheduler: ctx.scheduler,
      ingress: ctx.ingress,
    }
    this.#metadataManager = new AssetMetadataManager(managerContext)
    this.#balancesManager = new BalancesManager(managerContext, this.query.bind(this))
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

  async stop() {
    this.#metadataManager.stop()
    // balances manager stop
    await this.#balancesManager.stop()
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
