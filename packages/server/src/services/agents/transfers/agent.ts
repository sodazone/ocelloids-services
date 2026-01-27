import { Operation } from 'rfc6902'
import z from 'zod'
import { Subscription } from '@/services/subscriptions/types.js'
import { Logger } from '@/services/types.js'
import { DataSteward } from '../steward/agent.js'
import { TickerAgent } from '../ticker/agent.js'
import { Agent, AgentMetadata, AgentRuntimeContext, getAgentCapabilities, Subscribable } from '../types.js'
import { TransfersTracker } from './tracker.js'

const TRANSFERS_AGENT_ID = 'transfers'

export const $TransfersAgentInputs = z.object({
  networks: z.array(
    z.string({ required_error: 'Network URNs are required, e.g. "urn:ocn:polkadot:0"' }).min(1),
  ),
})

export type TransfersAgentInputs = z.infer<typeof $TransfersAgentInputs>

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

  start() {
    this.#tracker.start()
    this.#log.info('[agent:%s] started', this.id)
  }

  stop() {
    this.#tracker.stop()
    this.#log.info('[agent:%s] stopped', this.id)
  }

  collectTelemetry() {
    //
  }

  subscribe() {
    //
  }

  unsubscribe() {
    //
  }

  update(subscriptionId: string, patch: Operation[]): Subscription {
    throw new Error('Update not supported')
  }
}
