import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import {
  Agent,
  AgentMetadata,
  AgentRuntimeContext,
  getAgentCapabilities,
  Queryable,
  QueryParams,
  QueryResult,
  ServerSentEventsBroadcaster,
  ServerSentEventsRequest,
  Streamable,
} from '../types.js'
import { AccountsMetadataManager } from './accounts/manager.js'
import { BalancesManager } from './balances/manager.js'
import { BalanceEvents, createStewardBroadcaster } from './balances/sse.js'
import { AssetMetadataManager } from './metadata/manager.js'
import {
  $StewardQueryArgs,
  $StewardServerSentEventArgs,
  StewardQueryArgs,
  StewardServerSentEventArgs,
} from './types.js'

/**
 * The Data Steward agent.
 *
 * Aggregates and enriches cross-chain metadata for assets and currencies.
 */
export class DataSteward implements Agent, Queryable, Streamable<StewardServerSentEventArgs> {
  id = 'steward'

  querySchema = $StewardQueryArgs
  streamFilterSchema = $StewardServerSentEventArgs

  metadata: AgentMetadata = {
    name: 'Data Steward',
    description: 'Aggregates and enriches cross-chain metadata for assets and currencies.',
    capabilities: getAgentCapabilities(this),
  }

  readonly #metadataManager: AssetMetadataManager
  readonly #accountsManager: AccountsMetadataManager
  readonly #balancesManager?: BalancesManager
  readonly #substrateIngress: SubstrateIngressConsumer
  readonly #broadcaster: ServerSentEventsBroadcaster<StewardServerSentEventArgs, BalanceEvents>

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
    this.#accountsManager = new AccountsMetadataManager(managerContext)
    if (ctx.config && 'balances' in ctx.config && ctx.config['balances']) {
      this.#balancesManager = new BalancesManager(managerContext, this.query.bind(this), this.#broadcaster)
    }
    this.#substrateIngress = ctx.ingress.substrate
  }

  async query(params: QueryParams<StewardQueryArgs>): Promise<QueryResult> {
    // dispatch to correct manager
    const queryPaths = params.args.op.split('.')
    const queryType = queryPaths[0]
    if (queryType === 'assets' || queryType === 'chains') {
      return this.#metadataManager.queries(params)
    }
    if (queryType === 'accounts') {
      return this.#accountsManager.queries(params)
    }
    throw new Error(`Query type ${queryType} not supported`)
  }

  onServerSentEventsRequest(request: ServerSentEventsRequest<StewardServerSentEventArgs>) {
    if (this.#balancesManager && request.streamName === 'balances') {
      this.#balancesManager.onServerSentEventsRequest(request)
    } else {
      throw new Error(`SSE stream not supported: ${request.streamName}`)
    }
  }

  async stop() {
    await this.#balancesManager?.stop()
    this.#metadataManager.stop()
    this.#accountsManager.stop()
    this.#broadcaster.close()
  }

  async start() {
    await this.#substrateIngress.isReady()
    await this.#metadataManager.start()
    await this.#accountsManager.start()
    await this.#balancesManager?.start()
  }

  collectTelemetry() {
    // TODO: impl telemetry
  }
}
