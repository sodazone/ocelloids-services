import PQueue from 'p-queue'

import { immediate } from '@/common/event.loop.js'
import { ago } from '@/common/time.js'
import { asJSON, createTypedEventEmitter, deepCamelize } from '@/common/util.js'
import {
  urnToChainId,
  WormholeIds,
  WormholeSupportedNetworks,
} from '@/services/agents/wormhole/types/chain.js'
import { isWormholeId } from '@/services/networking/apis/wormhole/ids.js'
import {
  isWormholeProtocol,
  WormholeOperation,
  WormholeProtocols,
} from '@/services/networking/apis/wormhole/types.js'
import { Logger } from '@/services/types.js'
import { CrosschainExplorer } from '../crosschain/explorer.js'
import { CrosschainRepository, FullJourney, Journey, JourneyUpdate } from '../crosschain/index.js'
import { DataSteward } from '../steward/agent.js'
import { Agent, AgentMetadata, AgentRuntimeContext, getAgentCapabilities } from '../types.js'
import { mapOperationToJourney, mergeUpdatedStops, NewJourneyWithAssets } from './mappers/index.js'
import { TelemetryWormholeEventEmitter } from './telemetry/events.js'
import { collectWormholeStats, wormholeAgentMetrics } from './telemetry/metrics.js'
import { WormholeWorkerPool } from './worker.pool.js'

const OPERATION_LOOKUP_WINDOW_MS = 5 * 60_000
const PENDING_RECHECK_INTERVAL = 86_400_000 // 24h
const PENDING_RECHECK_WINDOW = 604_800_000 // 7 days
const RECHECK_DELAY_MS = Number(process.env.WORMHOLE_RECHECK_PENDING_DELAY_MS ?? 120_000)
const RECHECK_CONCURRENCY = Number(process.env.WORMHOLE_RECHECK_CONCURRENCY ?? 1)
const RECHECK_ENABLED = process.env.WORMHOLE_RECHECK_PENDING !== 'false'

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
  readonly #telemetry: TelemetryWormholeEventEmitter
  readonly #wormholeQueue: PQueue
  readonly #worker: WormholeWorkerPool

  constructor(
    ctx: AgentRuntimeContext,
    deps: {
      steward: DataSteward
      crosschain: CrosschainExplorer
    },
  ) {
    this.#log = ctx.log
    this.#config = ctx.config ?? {}
    this.#crosschain = deps.crosschain
    this.#repository = deps.crosschain?.repository

    this.#telemetry = createTypedEventEmitter<TelemetryWormholeEventEmitter>()
    this.#wormholeQueue = new PQueue({ concurrency: RECHECK_CONCURRENCY, interval: 1200, intervalCap: 1 })
    this.#worker = new WormholeWorkerPool(
      new URL('../../../../dist/services/agents/wormhole/worker.js', import.meta.url),
      { dataPath: process.env.OC_DATA_DIR ?? './.db/' },
    )
    this.#worker.onStream(async (msg) => {
      if (msg.op) {
        await this.#onOperation(msg.op)
      } else if (msg.error) {
        this.#log.error('[agent:%s] watcher stream error: %s', this.id, msg.error)
      }
    })

    this.#log.info('[agent:%s] created with config: %j', this.id, this.#config)
  }

  async stop() {
    await this.#worker.run('stop')
  }

  start() {
    if (this.#repository == null) {
      this.#log.error('[agent:%s] repository is not available', this.id)
      return
    }

    this.#log.info('[agent:%s] start', this.id)

    this.#worker.run('startWatcher', { chains: [WormholeIds.MOONBEAM_ID], since: ago(1, 'day') })

    this.#recheckPendingJourneys()
    setInterval(() => this.#recheckPendingJourneys(), PENDING_RECHECK_INTERVAL)
  }

  #broadcast = async (event: 'new_journey' | 'update_journey', id: number) => {
    const fullJourney = await this.#repository.getJourneyById(id)
    if (!fullJourney) {
      this.#telemetry.emit('telemetryWormholeError', { code: 'JOURNEY_NOT_FOUND', id: String(id) })

      throw new Error(`Failed to fetch ${id} journey after insert (${event})`)
    }
    this.#log.info('[agent:%s] broadcast %s:  %s', this.id, event, id)
    const journeyResponse = deepCamelize<FullJourney>(fullJourney)
    this.#crosschain.broadcastJourney(event, journeyResponse)
    this.#crosschain.emit(journeyResponse)

    this.#telemetry.emit('telemetryWormholeJourneyBroadcast', fullJourney)
  }

  async #recheckPendingJourneys() {
    if (!RECHECK_ENABLED) {
      return
    }

    this.#log.info(
      '[agent:%s] recheck pending journeys enabled (delay=%sms, concurrency=%s)',
      this.id,
      RECHECK_DELAY_MS,
      RECHECK_CONCURRENCY,
    )

    // Wait initial delay
    await new Promise((r) => setTimeout(r, RECHECK_DELAY_MS))

    const pendings = await this.#repository.getJourneysByStatus(
      ['sent', 'waiting'],
      [...WormholeProtocols],
      Date.now() - PENDING_RECHECK_WINDOW,
    )

    if (pendings.length === 0) {
      return
    }

    for (const journey of pendings) {
      this.#wormholeQueue.add(async () => {
        try {
          await this.#recheckJourney(journey)
        } catch (err) {
          this.#log.error('[agent:%s] journey recheck failed', this.id, err)
        }
        await immediate()
      })
    }

    this.#log.info('[agent:%s] pending recheck started (%s items)', this.id, pendings.length)
  }

  async #recheckJourney(journey: Journey) {
    try {
      const stop = journey.stops.find((s: any) => s.type === 'wormhole' || isWormholeProtocol(s.type))
      const opId = stop?.messageId || (isWormholeId(journey.correlation_id) ? journey.correlation_id : null)

      if (opId) {
        this.#log.info('[agent:%s] Refetching pending op %s', this.id, opId)
        const op = await this.#safeFetchOp(opId)
        if (op) {
          await this.#onOperation(op)
        }
        return
      }

      await this.#recheckBySearch(journey)
    } catch (err) {
      this.#log.warn(err, '[agent:%s] failed to recheck pending journey %s', this.id, journey.correlation_id)
    }
  }

  async #safeFetchOp(id: string) {
    try {
      const op = await this.#worker.run<WormholeOperation>('fetchOperation', { id })
      await immediate()
      return op
    } catch (err) {
      this.#log.error(err, '[agent:%s] fetchOperationById failed for %s', this.id, id)
      return null
    }
  }

  async #recheckBySearch(journey: Journey) {
    const isOriginLeg = isWormholeProtocol(journey.origin_protocol)
    const address = isOriginLeg ? journey.from : journey.to

    const stop = journey.stops.find((s: any) => s.type === 'wormhole' || isWormholeProtocol(s.type))
    if (!stop) {
      return
    }

    const sourceChain = urnToChainId(stop.from.chainId)
    const targetChain = urnToChainId(stop.to.chainId)

    const from = new Date(journey.sent_at - OPERATION_LOOKUP_WINDOW_MS).toISOString()
    const to = new Date(journey.sent_at + OPERATION_LOOKUP_WINDOW_MS).toISOString()
    const searchOp = {
      address,
      sourceChain,
      targetChain,
      from,
      to,
    }

    const { operations } = await this.#worker.run<{ operations: WormholeOperation[] }>('fetchOperations', {
      search: searchOp,
    })

    if (operations.length === 0) {
      this.#log.info('[agent:%s] No ops found from search %s', this.id, JSON.stringify(searchOp))
    }

    for (const op of operations) {
      this.#log.info('[agent:%s] Refetched pending op from search %s', this.id, op.id)
      await this.#onOperation(op)
    }
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

    if (op.vaa === undefined) {
      this.#log.warn('[agent:%s] No VAA found in op %s (status=%s)', this.id, op.id, journey.status)
    }

    const existingTrips = await this.#repository.getJourneyByTripId(journey.trip_id)
    const existingJourney = await this.#repository.getJourneyByCorrelationId(journey.correlation_id)
    if (!existingJourney) {
      const { assets, ...journeyWithoutAssets } = journey
      const id = await this.#repository.insertJourneyWithAssets(journeyWithoutAssets, assets)
      if (existingTrips.length > 0) {
        this.#log.info(
          '[agent:%s:connecting-trip] New journey trip=%s journey=%s tripId=%s',
          this.id,
          existingTrips.map((t) => t.id),
          id,
          journey.trip_id,
        )
        setImmediate(() => this.#updateTrip(journey, existingTrips, id))
        return
      }
      this.#broadcast('new_journey', id)
      return
    }

    if (existingJourney.status !== 'received') {
      const update: JourneyUpdate = {}
      if (existingJourney.status !== journey.status) {
        if (isWormholeProtocol(journey.destination_protocol) || journey.status !== 'received') {
          update.status = journey.status
        }

        if (isWormholeProtocol(journey.destination_protocol) && journey.recv_at && !existingJourney.recv_at) {
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
      }

      if (journey.trip_id && !existingJourney.trip_id) {
        update.trip_id = journey.trip_id
      }

      if (op.vaa !== undefined) {
        update.stops = journey.stops
      } else {
        update.stops = asJSON(mergeUpdatedStops(op, existingJourney.stops))
      }

      await this.#repository.updateJourney(existingJourney.id, update)
      if (existingTrips.length > 0) {
        this.#log.info(
          '[agent:%s:connecting-trip] Update journey trip=%s journey=%s tripId=%s',
          this.id,
          existingTrips.map((t) => t.id),
          existingJourney.id,
          journey.trip_id,
        )
        setImmediate(() => this.#updateTrip(journey, existingTrips, existingJourney.id))
        return
      }
      this.#broadcast('update_journey', existingJourney.id)
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
        if (isWormholeProtocol(journey.origin_protocol)) {
          result = await merge(journeyId, existingTrip.id)
        } else if (isWormholeProtocol(journey.destination_protocol)) {
          result = await merge(existingTrip.id, journeyId)
        }
      } else if (isWormholeProtocol(existingTrip.origin_protocol)) {
        result = await merge(journeyId, existingTrip.id)
      } else if (isWormholeProtocol(existingTrip.destination_protocol)) {
        result = await merge(existingTrip.id, journeyId)
      }

      this.#broadcast('update_journey', result?.updatedIds.id ?? journeyId)

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
      }
    } catch (e) {
      this.#log.error(e, '[wh:connecting-trip] error %s', journeyId)
    }
  }

  collectTelemetry() {
    wormholeAgentMetrics(this.#telemetry)

    return [
      collectWormholeStats({
        pending: () => 0, //this.#watcher.pendingCount(),
      }),
    ]
  }
}
