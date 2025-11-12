import { Subscription } from 'rxjs'
import { Logger } from '@/services/types.js'
import { CrosschainExplorer } from '../crosschain/explorer.js'
import { CrosschainRepository } from '../crosschain/index.js'
import { Agent, AgentMetadata, AgentRuntimeContext, getAgentCapabilities } from '../types.js'
import { HyperbridgeTracker } from './tracking.js'
import { HyperbridgeMessagePayload } from './types.js'

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
  readonly #tracker: HyperbridgeTracker
  readonly #subs: Subscription[] = []

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
    this.#tracker = new HyperbridgeTracker(ctx)

    this.#log.info('[agent:%s] created with config: %j', this.id, this.#config)
  }

  async start() {
    await this.#tracker.start()

    this.#subs.push(
      this.#tracker.ismp$.subscribe({
        next: (msg: HyperbridgeMessagePayload) => {
          console.log('HYPRBRIDGE ----', msg)
        },
        error: (err) => {
          // this.#telemetry.emit('telemetryHyperbridgeError', { code: 'WATCHER_ERROR', id: 'watcher' })
          this.#log.error(err, '[agent:%s] tracker stream error', this.id)
        },
        complete: () => {
          this.#log.info('[agent:%s] tracker stream completed', this.id)
        },
      }),
    )
  }

  stop() {
    this.#tracker.stop()
    this.#subs.forEach((sub) => sub.unsubscribe())
  }

  collectTelemetry() {
    // implement
  }
}
