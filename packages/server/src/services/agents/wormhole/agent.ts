import { Observer, Subscription } from 'rxjs'
import { ago } from '@/common/time.js'
import { deepCamelize } from '@/common/util.js'
import { WormholeIds } from '@/services/agents/wormhole/types/chain.js'
import { WormholescanClient } from '@/services/networking/apis/wormhole/client.js'
import { makeWormholeLevelStorage } from '@/services/networking/apis/wormhole/storage.js'
import { WormholeOperation } from '@/services/networking/apis/wormhole/types.js'
import { makeWatcher, WormholeWatcher } from '@/services/networking/apis/wormhole/watcher.js'
import { Logger } from '@/services/types.js'
import { CrosschainExplorer } from '../crosschain/explorer.js'
import { CrosschainRepository, FullJourney, JourneyStatus, JourneyUpdate } from '../crosschain/index.js'
import { DataSteward } from '../steward/agent.js'
import { Agent, AgentMetadata, AgentRuntimeContext, getAgentCapabilities } from '../types.js'
import { mapOperationToJourney } from './mappers/index.js'

export const WORMHOLE_AGENT_ID = 'wormhole'

export class WormholeAgent implements Agent {
  id = WORMHOLE_AGENT_ID
  metadata: AgentMetadata = {
    name: 'Wormhole Agent',
    description: 'Indexes and tracks Wormhole operations.',
    capabilities: getAgentCapabilities(this),
    runInBackground: true,
  }

  readonly #log: Logger
  readonly #config: Record<string, any>
  readonly #crosschain: CrosschainExplorer
  readonly #repository: CrosschainRepository
  readonly #watcher: WormholeWatcher
  readonly #subs: Subscription[]

  constructor(
    ctx: AgentRuntimeContext,
    deps: {
      steward: DataSteward
      crosschain: CrosschainExplorer
    },
  ) {
    this.#log = ctx.log
    this.#config = ctx.config ?? {}
    this.#subs = []
    this.#crosschain = deps.crosschain
    this.#repository = deps.crosschain?.repository

    const storage = makeWormholeLevelStorage(ctx.db)
    this.#watcher = makeWatcher(new WormholescanClient(), storage)

    this.#log.info('[agent:%s] created with config: %j', this.id, this.#config)
  }

  stop() {
    this.#subs.forEach((sub) => sub.unsubscribe())
  }

  start() {
    this.#log.info('[agent:%s] start', this.id)

    this.#watcher.loadInitialState([WormholeIds.MOONBEAM_ID], ago(1, 'day')).then((init) => {
      this.#log.info(
        '[agent:%s] subscribe to operations: %j',
        this.id,
        Object.values(init.cursors).map((c) => ({
          chain: c.chain,
          direction: c.direction,
          lastSeen: c.lastSeen,
          seenIds: c.seenIds?.length ?? 0,
        })),
      )
      this.#subs.push(this.#watcher.operations$(init).subscribe(this.#makeObserver()))
    })
  }

  #makeObserver(): Observer<{ op: WormholeOperation; status: JourneyStatus }> {
    return {
      next: async ({ op }) => {
        try {
          await this.#onOperation(op)
        } catch (err) {
          this.#log.error(err, '[agent:%s] watcher error while processing %s', this.id, op.id)
        }
      },
      error: (err) => {
        this.#log.error(err, '[agent:%s] watcher error', this.id)
      },
      complete: () => {
        this.#log.info('[agent:%s] watcher completed', this.id)
      },
    }
  }

  async #broadcast(event: 'new_journey' | 'update_journey', id: number) {
    const fullJourney = await this.#repository.getJourneyById(id)
    if (!fullJourney) {
      throw new Error(`Failed to fetch ${id} journey after insert (${event})`)
    }
    this.#log.info('[%s] broadcast %s:  %s', this.id, event, id)
    this.#crosschain.broadcastJourney(event, deepCamelize<FullJourney>(fullJourney))
  }

  async #onOperation(op: WormholeOperation) {
    const journey = mapOperationToJourney(op)
    const existing = await this.#repository.getJourneyByCorrelationId(journey.correlation_id)

    if (!existing) {
      const { assets, ...journeyWithoutAssets } = journey
      const id = await this.#repository.insertJourneyWithAssets(journeyWithoutAssets, assets)
      await this.#broadcast('new_journey', id)
      return
    }

    if (existing.status !== journey.status) {
      const update: JourneyUpdate = {}
      update.status = journey.status

      if (journey.recv_at && !existing.recv_at) {
        update.recv_at = journey.recv_at
      }

      if (journey.to !== existing.to) {
        update.to = journey.to
        update.to_formatted = journey.to_formatted
      }
      if (journey.from !== existing.from) {
        update.from = journey.from
        update.from_formatted = journey.from_formatted
      }

      update.stops = journey.stops

      await this.#repository.updateJourney(existing.id, update)
      await this.#broadcast('update_journey', existing.id)
    }
  }

  collectTelemetry() {
    // TBD
  }
}
