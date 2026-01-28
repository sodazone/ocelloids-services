import { Operation } from 'rfc6902'
import { Subscription } from '@/services/subscriptions/types.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { DataSteward } from '../steward/agent.js'
import { TickerAgent } from '../ticker/agent.js'
import { Agent, AgentMetadata, AgentRuntimeContext, getAgentCapabilities, Subscribable } from '../types.js'
import { TransfersTracker } from './tracker.js'
import { $TransfersAgentInputs, TransfersAgentInputs } from './type.js'

const TRANSFERS_AGENT_ID = 'transfers'

export class TransfersAgent implements Agent, Subscribable {
  id = TRANSFERS_AGENT_ID
  metadata: AgentMetadata = {
    name: 'Transfers Agent',
    description: 'Indexes and tracks intra-chain transfers.',
    capabilities: getAgentCapabilities(this),
  }

  readonly inputSchema = $TransfersAgentInputs
  readonly #log: Logger
  readonly #tracker: TransfersTracker

  constructor(
    ctx: AgentRuntimeContext,
    deps: {
      steward: DataSteward
      ticker: TickerAgent
    },
  ) {
    const { ingress } = ctx

    this.#log = ctx.log
    this.#tracker = new TransfersTracker({
      log: ctx.log,
      ingress: ingress.substrate,
      steward: deps.steward,
      ticker: deps.ticker,
    })

    this.#log.info('[agent:%s] created ', this.id)
  }

  async start() {
    await this.#tracker.start()
    this.#log.info('[agent:%s] started', this.id)
  }

  stop() {
    this.#tracker.stop()
    this.#log.info('[agent:%s] stopped', this.id)
  }

  collectTelemetry() {
    //
  }

  subscribe(subscription: Subscription<TransfersAgentInputs>) {
    const { id, args } = subscription

    this.#validateNetworks(args)
  }

  unsubscribe() {
    //
  }

  update(subscriptionId: string, patch: Operation[]): Subscription {
    throw new Error('Update not supported')
  }

  #validateNetworks({ networks }: TransfersAgentInputs) {
    if (networks !== '*') {
      this.#tracker.validateNetworks(networks as NetworkURN[])
    }
  }
}
