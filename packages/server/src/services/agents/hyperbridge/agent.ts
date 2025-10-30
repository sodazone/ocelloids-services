import { IngressConsumers } from '@/services/ingress/index.js'
import { SubstrateSharedStreams } from '@/services/networking/substrate/shared.js'
import { Logger } from '@/services/types.js'
import { CrosschainExplorer } from '../crosschain/explorer.js'
import { CrosschainRepository } from '../crosschain/index.js'
import { Agent, AgentMetadata, AgentRuntimeContext, getAgentCapabilities } from '../types.js'

export const HYPERBRIDGE_AGENT_ID = 'hyperbridge'

export class HyperbridgeAgent implements Agent {
  id = HYPERBRIDGE_AGENT_ID
  metadata: AgentMetadata = {
    name: 'Hyperbridge Agent',
    description: 'Indexes and tracks Hyperbridge operations.',
    capabilities: getAgentCapabilities(this),
    runInBackground: true,
  }

  readonly #log: Logger
  readonly #config: Record<string, any>
  readonly #crosschain: CrosschainExplorer
  readonly #repository: CrosschainRepository

  constructor(
    ctx: AgentRuntimeContext,
    deps: {
      crosschain: CrosschainExplorer
    },
  ) {
    this.#log = ctx.log
    this.#config = ctx.config ?? {}
    this.#crosschain = deps.crosschain
    this.#repository = deps.crosschain?.repository

    this.#log.info('[agent:%s] created with config: %j', this.id, this.#config)
  }

  start() {}

  stop() {}

  collectTelemetry() {
    // implement
  }
}
