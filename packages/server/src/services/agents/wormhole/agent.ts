import { LRUCache } from 'lru-cache'
import { Observer, Subscription } from 'rxjs'
import { ago } from '@/common/time.js'
import { createTypedEventEmitter, deepCamelize } from '@/common/util.js'
import { WormholeIds, WormholeSupportedNetworks } from '@/services/agents/wormhole/types/chain.js'
import { WormholescanClient } from '@/services/networking/apis/wormhole/client.js'
import { makeWormholeLevelStorage } from '@/services/networking/apis/wormhole/storage.js'
import { WormholeOperation, WormholeProtocols } from '@/services/networking/apis/wormhole/types.js'
import { makeWatcher, WormholeWatcher } from '@/services/networking/apis/wormhole/watcher.js'
import { Logger } from '@/services/types.js'
import { CrosschainExplorer } from '../crosschain/explorer.js'
import {
  CrosschainRepository,
  FullJourney,
  Journey,
  JourneyStatus,
  JourneyUpdate,
} from '../crosschain/index.js'
import { DataSteward } from '../steward/agent.js'
import { Agent, AgentMetadata, AgentRuntimeContext, getAgentCapabilities } from '../types.js'
import { mapOperationToJourney, NewJourneyWithAssets } from './mappers/index.js'
import { TelemetryWormholeEventEmitter } from './telemetry/events.js'
import { collectWormholeStats, wormholeAgentMetrics } from './telemetry/metrics.js'

function isChainSupported(chainId?: number): boolean {
  return chainId === undefined || WormholeSupportedNetworks.includes(chainId)
}

function isSupportedWormholeOp(op: WormholeOperation): boolean {
  return (
    isChainSupported(op.sourceChain?.chainId) &&
    isChainSupported(op.targetChain?.chainId) &&
    isChainSupported(op.content?.standarizedProperties?.toChain)
  )
}

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
  readonly #telemetry: TelemetryWormholeEventEmitter
  readonly #replacedJourneysCache: LRUCache<string, number>

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
    this.#telemetry = createTypedEventEmitter<TelemetryWormholeEventEmitter>()
    this.#replacedJourneysCache = new LRUCache({
      ttl: 3_600_000, // 1 hr
      ttlResolution: 60_000,
      ttlAutopurge: false,
      max: 1_000,
    })

    this.#log.info('[agent:%s] created with config: %j', this.id, this.#config)
  }

  stop() {
    this.#subs.forEach((sub) => sub.unsubscribe())
  }

  start() {
    if (this.#repository == null) {
      this.#log.error('[agent:%s] repository is not available', this.id)
      return
    }

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

    this.#recheckPendingJourneys()
  }

  #makeObserver = (): Observer<{ op: WormholeOperation; status: JourneyStatus }> => ({
    next: async ({ op }) => {
      try {
        await this.#onOperation(op)
      } catch (err) {
        this.#telemetry.emit('telemetryWormholeError', { code: 'OP_ERROR', id: op.id })
        this.#log.error(err, '[agent:%s] watcher error while processing %s', this.id, op.id)
      }
    },
    error: (err) => {
      this.#telemetry.emit('telemetryWormholeError', { code: 'WATCHER_ERROR', id: 'watcher' })
      this.#log.error(err, '[agent:%s] watcher error', this.id)
    },
    complete: () => {
      this.#log.info('[agent:%s] watcher completed', this.id)
    },
  })

  #broadcast = async (event: 'new_journey' | 'update_journey', id: number) => {
    const fullJourney = await this.#repository.getJourneyById(id)
    if (!fullJourney) {
      this.#telemetry.emit('telemetryWormholeError', { code: 'JOURNEY_NOT_FOUND', id: String(id) })

      throw new Error(`Failed to fetch ${id} journey after insert (${event})`)
    }
    this.#log.info('[agent:%s] broadcast %s:  %s', this.id, event, id)
    this.#crosschain.broadcastJourney(event, deepCamelize<FullJourney>(fullJourney))

    this.#telemetry.emit('telemetryWormholeJourneyBroadcast', fullJourney)
  }

  async #recheckPendingJourneys() {
    const enabled = process.env.WORMHOLE_RECHECK_PENDING === 'true'
    if (!enabled) {
      return
    }
    const delay = Number(process.env.WORMHOLE_RECHECK_PENDING_DELAY_MS ?? 15_000)

    this.#log.info('[agent:%s] recheck pending journeys enabled (delay=%sms)', this.id, delay)

    await new Promise((r) => setTimeout(r, delay))

    this.#log.info('[agent:%s] rechecking pending journeys...', this.id)

    const pendings = await this.#repository.getJourneysByStatus('sent', [...WormholeProtocols])

    for (const journey of pendings) {
      try {
        const op = await this.#watcher.fetchOperationById(journey.correlation_id)
        if (op) {
          await this.#onOperation(op)
        }
      } catch (err) {
        this.#log.warn(
          err,
          '[agent:%s] failed to recheck pending journey %s',
          this.id,
          journey.correlation_id,
        )
      }
    }

    this.#log.info('[agent:%s] pending recheck complete (%s items)', this.id, pendings.length)
  }

  #onOperation = async (op: WormholeOperation) => {
    if (!isSupportedWormholeOp(op)) {
      this.#log.warn(
        '[agent:%s] Skipping operation due to unsupported network(s): sourceChainId=%s, targetChainId=%s',
        this.id,
        op.sourceChain.chainId,
        op.targetChain?.chainId,
      )
      return
    }

    const journey = mapOperationToJourney(op, this.#repository.generateTripId.bind(this))
    if (this.#replacedJourneysCache.has(journey.correlation_id)) {
      this.#log.info('[agent:%s] Journey replaced for correlationId: %s', this.id, journey.correlation_id)
    }
    const existingTrips = await this.#repository.getJourneyByTripId(journey.trip_id)
    const existingJourney = await this.#repository.getJourneyByCorrelationId(journey.correlation_id)
    if (!existingJourney) {
      const { assets, ...journeyWithoutAssets } = journey
      const id = await this.#repository.insertJourneyWithAssets(journeyWithoutAssets, assets)
      if (existingTrips.length > 0) {
        this.#log.info(
          '[agent:%s:connecting-trip] trip=%s journey=%s tripId=%s',
          this.id,
          existingTrips.map((t) => t.id),
          id,
          journey.trip_id,
        )
        await this.#updateTrip(journey, existingTrips, id)
        return
      }
      await this.#broadcast('new_journey', id)
      return
    }

    if (existingJourney.status !== journey.status) {
      const update: JourneyUpdate = {}
      update.status = journey.status

      if (journey.recv_at && !existingJourney.recv_at) {
        update.recv_at = journey.recv_at
      }

      if (journey.to !== existingJourney.to) {
        update.to = journey.to
        update.to_formatted = journey.to_formatted
      }
      if (journey.from !== existingJourney.from) {
        update.from = journey.from
        update.from_formatted = journey.from_formatted
      }
      if (journey.destination !== existingJourney.destination) {
        update.destination = journey.destination
      }
      if (journey.trip_id && !existingJourney.trip_id) {
        update.trip_id = journey.trip_id
      }

      update.stops = journey.stops

      await this.#repository.updateJourney(existingJourney.id, update)
      if (existingTrips.length > 0) {
        this.#log.info(
          '[agent:%s:connecting-trip] trip=%s journey=%s tripId=%s',
          this.id,
          existingTrips.map((t) => t.id),
          existingJourney.id,
          journey.trip_id,
        )
        await this.#updateTrip(journey, existingTrips, existingJourney.id)
        return
      }
      await this.#broadcast('update_journey', existingJourney.id)
    }
  }

  async #updateTrip(journey: NewJourneyWithAssets, existingTrips: Journey[], journeyId: number) {
    const existingTrip =
      existingTrips.length === 1
        ? existingTrips[0]
        : existingTrips.find((t) => t.origin_protocol !== t.destination_protocol)
    if (!existingTrip) {
      return
    }

    const merge = async (
      firstId: number,
      secondId: number,
    ): Promise<{ updatedIds: { id: number; correlationId: string }; replaces: Journey | null }> => {
      const { updated, deleted } = await this.#repository.mergeJourneys(firstId, secondId, journey.trip_id)
      this.#log.info(
        '[agent:wormhole] Journey merge updated=%s,%s deleted=%s,%s',
        updated.id,
        updated.correlationId,
        deleted?.id ?? 'null',
        deleted?.correlation_id ?? 'null',
      )
      return { updatedIds: { ...updated }, replaces: deleted }
    }

    try {
      let result: { updatedIds: { id: number; correlationId: string }; replaces: Journey | null } | null =
        null

      if (journey.origin_protocol !== journey.destination_protocol) {
        if (WormholeProtocols.includes(journey.origin_protocol as any)) {
          result = await merge(journeyId, existingTrip.id)
        } else if (WormholeProtocols.includes(journey.destination_protocol as any)) {
          result = await merge(existingTrip.id, journeyId)
        }
      } else if (WormholeProtocols.includes(existingTrip.origin_protocol as any)) {
        result = await merge(journeyId, existingTrip.id)
      } else if (WormholeProtocols.includes(existingTrip.destination_protocol as any)) {
        result = await merge(existingTrip.id, journeyId)
      }

      await this.#broadcast('update_journey', result?.updatedIds.id ?? journeyId)

      if (result?.replaces && result.updatedIds) {
        const replacesJourneyAssets = await this.#repository.getJourneyAssets(result.updatedIds.id)
        this.#crosschain.broadcastReplaceJourney({
          ids: result.updatedIds,
          replaces: {
            ...deepCamelize<Journey>(result.replaces),
            assets: replacesJourneyAssets,
            totalUsd: replacesJourneyAssets.reduce((sum, a) => sum + (a.usd ?? 0), 0),
          },
        })
        this.#replacedJourneysCache.set(result.replaces.correlation_id, result.replaces.id)
      }
    } catch (e) {
      this.#log.error(e, '[wh:connecting-trip] error %s', journeyId)
    }
  }

  collectTelemetry() {
    wormholeAgentMetrics(this.#telemetry)

    return [
      collectWormholeStats({
        pending: () => this.#watcher.pendingCount(),
      }),
    ]
  }
}
