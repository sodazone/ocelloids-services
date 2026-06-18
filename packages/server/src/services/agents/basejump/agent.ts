import { mergeMap, Subscription } from 'rxjs'
import { asJSON } from '@/common/util.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { toAssetId } from '../common/assets.js'
import { HOUR } from '../common/time.js'
import { fullJourneyToResponse, journeyToResponse } from '../crosschain/convert.js'
import { CrosschainExplorer } from '../crosschain/explorer.js'
import { CrosschainRepository, FullJourney, JourneyUpdate, NewAssetOperation } from '../crosschain/index.js'
import { DataSteward } from '../steward/agent.js'
import { AssetMetadata, Empty, isAssetMetadata, StewardQueryArgs } from '../steward/types.js'
import { TickerAgent } from '../ticker/agent.js'
import { AggregatedPriceData, TickerQueryArgs } from '../ticker/types.js'
import {
  Agent,
  AgentMetadata,
  AgentRuntimeContext,
  getAgentCapabilities,
  QueryParams,
  QueryResult,
} from '../types.js'
import { toBasejumpStops, toNewJourney, toStatus, toUniqueCorrelationId } from './crosschain.js'
import { BasejumpTracker } from './tracking.js'
import {
  BasejumpMessagePayload,
  BasejumpMessagePayloadWithMetadata,
  isBasejumpProcessed,
  MessageTerminusContext,
  ResolvedAsset,
} from './types.js'

export const BASEJUMP_AGENT_ID = 'basejump'
const TRIP_ID_MAP_TTL_MS = 12 * HOUR

export class BasejumpAgent implements Agent {
  id = BASEJUMP_AGENT_ID
  metadata: AgentMetadata = {
    name: 'Basejump Agent',
    description: 'Indexes and tracks Basejump operations.',
    capabilities: getAgentCapabilities(this),
    runInBackground: true,
  }

  readonly #log: Logger
  readonly #config: Record<string, any>
  readonly #crosschain: CrosschainExplorer
  readonly #repository: CrosschainRepository
  readonly #ticker: TickerAgent
  readonly #steward: DataSteward
  readonly #tracker: BasejumpTracker
  readonly #subs: Subscription[] = []

  // correlationId to tripId map
  readonly #tripIdMap = new Map<string, { tripId: string; updatedAt: number }>()
  #tripIdCleanupTimer?: NodeJS.Timeout

  constructor(
    ctx: AgentRuntimeContext,
    deps: {
      ticker: TickerAgent
      steward: DataSteward
      crosschain: CrosschainExplorer
    },
  ) {
    this.#log = ctx.log
    this.#crosschain = deps.crosschain
    this.#repository = deps.crosschain?.repository
    this.#ticker = deps.ticker
    this.#steward = deps.steward
    this.#config = ctx.config ?? {}
    this.#tracker = new BasejumpTracker(ctx)

    this.#log.info('[agent:%s] created with config: %j', this.id, this.#config)
  }

  async start() {
    await this.#tracker.start()

    this.#subs.push(
      this.#tracker.basejump$.pipe(mergeMap(this.#withMetadata.bind(this))).subscribe({
        next: (msg) => this.#onMessage(msg),
        error: (err) => {
          this.#log.error(err, '[agent:%s] tracker stream error', this.id)
        },
        complete: () => {
          this.#log.info('[agent:%s] tracker stream completed', this.id)
        },
      }),
    )

    this.#tripIdCleanupTimer = setInterval(() => this.#cleanupTripIdMap(), HOUR).unref()

    this.#log.info('[agent:%s] started', this.id)
  }

  stop() {
    this.#tracker.stop()
    this.#subs.forEach((sub) => sub.unsubscribe())
    if (this.#tripIdCleanupTimer) {
      clearInterval(this.#tripIdCleanupTimer)
    }
    this.#log.info('[agent:%s] stopped', this.id)
  }

  collectTelemetry() {
    // TODO: implement
  }

  #broadcast = async (event: 'new_journey' | 'update_journey', id: number) => {
    const fullJourney = await this.#repository.getJourneyById(id)
    if (!fullJourney) {
      throw new Error(`Failed to fetch ${id} journey after insert (${event})`)
    }
    this.#log.info('[agent:%s] broadcast %s:  %s', this.id, event, id)
    const journeyResponse = fullJourneyToResponse(fullJourney)
    this.#crosschain.broadcastJourney(event, journeyResponse)
    this.#crosschain.emit(journeyResponse)
  }

  async #withMetadata(message: BasejumpMessagePayload): Promise<BasejumpMessagePayloadWithMetadata> {
    const assets: ResolvedAsset[] = []
    const {
      asset,
      amount,
      fee,
      origin: { chainId },
    } = message
    const results = await this.#fetchAssetMetadata(chainId, [asset])

    const metadata = results.length > 0 ? results[0] : undefined
    const usd = await this.#calculateVolume({
      chainId,
      id: asset,
      amount,
      decimals: metadata?.decimals,
    })
    assets.push({
      asset: toAssetId(chainId, asset),
      amount,
      symbol: metadata?.symbol,
      decimals: metadata?.decimals,
      usd,
      role: 'transfer',
    })

    if (fee) {
      const usdFee = await this.#calculateVolume({
        chainId,
        id: asset,
        amount: fee,
        decimals: metadata?.decimals,
      })

      assets.push({
        asset: toAssetId(chainId, asset),
        amount: fee,
        symbol: metadata?.symbol,
        decimals: metadata?.decimals,
        usd: usdFee,
        role: 'fee',
      })
    }

    return {
      ...message,
      assets,
    }
  }

  async #calculateVolume({
    chainId,
    id,
    amount,
    decimals,
  }: {
    chainId: NetworkURN
    id: string
    amount: string
    decimals?: number
  }): Promise<number | undefined> {
    const price = await this.#fetchAssetPrice(chainId, id)
    if (price === null || decimals === undefined) {
      return
    }
    const normalizedAmount = Number(amount) / 10 ** decimals
    return normalizedAmount * price
  }

  async #onMessage(message: BasejumpMessagePayloadWithMetadata) {
    console.log('BASEJUMP', message)
    try {
      const correlationId = toUniqueCorrelationId(message)
      const existingJourney = await this.#repository.getJourneyByCorrelationId(correlationId)

      if (existingJourney && (existingJourney.status === 'received' || existingJourney.status === 'failed')) {
        this.#log.info('[%s:explorer] Journey complete for correlationId: %s', this.id, correlationId)
        return
      }

      switch (message.type) {
        case 'basejump.initiated': {
          if (existingJourney) {
            this.#log.info(
              '[%s:explorer] Journey already exists for correlationId: %s (sent_at: %s)',
              this.id,
              correlationId,
              existingJourney.sent_at,
            )
            return
          }
          try {
            const journey = toNewJourney(correlationId, message)
            const assets: Omit<NewAssetOperation, 'journey_id'>[] = message.assets

            const id = await this.#repository.insertJourneyWithAssets(journey, assets)
            this.#broadcast('new_journey', id)
          } catch (err) {
            this.#log.error(
              err,
              '[%s:explorer] Error inserting new journey for correlationId: %s',
              this.id,
              correlationId,
            )
          }

          break
        }
        case 'basejump.processed':
        case 'basejump.executed':
        case 'basejump.queued':
        case 'basejump.fulfilled':
        case 'basejump.unmatched': {
          if (!existingJourney) {
            const updated = await this.#updateJourneyFromTripId(correlationId, message)

            if (!updated) {
              this.#log.warn(
                '[%s:explorer] Journey not found for correlationId: %s (%s)',
                this.id,
                correlationId,
                message.type,
              )
            }

            return
          }

          await this.#updateJourney(message, existingJourney)

          const merged = await this.#tryMergeJourney(existingJourney)

          if (!merged) {
            this.#broadcast('update_journey', existingJourney.id)
          }

          break
        }
        default:
          this.#log.warn('[%s:explorer] Unhandled message %j', this.id, message)
      }
    } catch (error) {
      this.#log.error(error, '[%s: explorer] Error processing message %j', this.id, asJSON(message))
    }
  }

  async #updateJourney(message: BasejumpMessagePayloadWithMetadata, existingJourney: FullJourney) {
    const stops = JSON.parse(existingJourney.stops)
    const existingStops = Array.isArray(stops) ? stops : [stops]

    const updatedStops = toBasejumpStops(message, existingStops)
    const updateWith: Partial<JourneyUpdate> = {
      status: toStatus(message),
      stops: asJSON(updatedStops),
    }

    if (isBasejumpProcessed(message)) {
      const { chainId, txHashSecondary } = message.waypoint
      const tripId = txHashSecondary
        ? this.#repository.generateTripId({ chainId, values: [txHashSecondary] })
        : undefined
      if (tripId) {
        updateWith.trip_id = tripId
        this.#setTripId(existingJourney.correlation_id, tripId)
      }
    }

    if (this.#isJourneyComplete(message)) {
      this.#deleteTripId(existingJourney.correlation_id)

      const { timestamp, txHash, txHashSecondary } = message.destination as MessageTerminusContext
      updateWith.recv_at = timestamp
      ;(updateWith.destination_tx_primary = txHash), (updateWith.destination_tx_secondary = txHashSecondary)
    }
    await this.#repository.updateJourney(existingJourney.id, updateWith)
  }

  async #updateJourneyFromTripId(
    correlationId: string,
    message: BasejumpMessagePayloadWithMetadata,
  ): Promise<boolean> {
    const tripIdData = this.#getTripId(correlationId)

    if (!tripIdData) {
      return false
    }

    const [trip] = await this.#repository.getJourneyByTripId(tripIdData.tripId)

    if (!trip) {
      return false
    }
    if (trip.status === 'received' || trip.status === 'failed') {
      return true
    }

    const updatedStops = toBasejumpStops(message, JSON.parse(trip.stops))

    const updateWith: Partial<JourneyUpdate> = {
      stops: asJSON(updatedStops),
      status: toStatus(message),
    }

    if (this.#isJourneyComplete(message)) {
      this.#deleteTripId(correlationId)

      const { timestamp, txHashSecondary, txHash } = message.destination as MessageTerminusContext
      updateWith.recv_at = timestamp
      ;(updateWith.destination_tx_primary = txHash), (updateWith.destination_tx_secondary = txHashSecondary)
    } else {
      this.#touchTripId(correlationId)
    }

    await this.#repository.updateJourney(trip.id, updateWith)
    this.#broadcast('update_journey', trip.id)

    return true
  }

  async #tryMergeJourney(existingJourney: FullJourney): Promise<boolean> {
    if (!existingJourney.trip_id) {
      return false
    }

    const trips = await this.#repository.getJourneyByTripId(existingJourney.trip_id)

    const xcmLeg = trips.find((trip) => trip.origin_protocol === 'xcm' && trip.destination_protocol === 'xcm')

    if (!xcmLeg) {
      return false
    }

    if (existingJourney.origin === xcmLeg.origin) {
      await this.#mergeJourneys(xcmLeg.id, existingJourney.id, existingJourney.trip_id)

      return true
    }

    if (existingJourney.destination === xcmLeg.destination) {
      await this.#mergeJourneys(existingJourney.id, xcmLeg.id, existingJourney.trip_id, {
        to: existingJourney.to,
        to_formatted: existingJourney.to_formatted,
        status: existingJourney.status === 'waiting' ? existingJourney.status : undefined,
      })

      return true
    }

    return false
  }

  async #mergeJourneys(firstLegId: number, secondLegId: number, tripId: string, overrides?: JourneyUpdate) {
    const { updated, deleted } = await this.#repository.mergeJourneys(
      firstLegId,
      secondLegId,
      tripId,
      overrides,
    )

    this.#log.info(
      '[agent:%s] Journey merge updated=%s,%s deleted=%s,%s',
      this.id,
      updated.id,
      updated.correlationId,
      deleted?.id ?? 'null',
      deleted?.correlation_id ?? 'null',
    )

    this.#broadcast('update_journey', updated.id)

    if (!deleted) {
      return
    }

    const assets = await this.#repository.getJourneyAssets(updated.id)

    this.#crosschain.broadcastReplaceJourney({
      ids: updated,
      replaces: {
        ...journeyToResponse(deleted),
        assets,
        totalUsd: assets.reduce((sum, asset) => sum + (asset.usd ?? 0), 0),
      },
    })
  }

  #isJourneyComplete(message: BasejumpMessagePayloadWithMetadata) {
    return message.type === 'basejump.executed' || message.type === 'basejump.fulfilled'
  }

  async #fetchAssetMetadata(network: string, assets: string[]): Promise<AssetMetadata[]> {
    const { items } = (await this.#steward.query({
      args: {
        op: 'assets',
        criteria: [
          {
            network,
            assets,
          },
        ],
      },
    } as QueryParams<StewardQueryArgs>)) as QueryResult<AssetMetadata | Empty>

    return items.map((i) => (isAssetMetadata(i) ? i : null)).filter((i) => i !== null)
  }

  async #fetchAssetPrice(chainId: NetworkURN, assetId: string): Promise<number | null> {
    const { items } = (await this.#ticker.query({
      args: {
        op: 'prices.by_asset',
        criteria: [{ chainId, assetId }],
      },
    } as QueryParams<TickerQueryArgs>)) as QueryResult<AggregatedPriceData>
    return items.length > 0 ? items[0].medianPrice : null
  }

  #getTripId(correlationId: string) {
    const entry = this.#tripIdMap.get(correlationId)
    if (!entry) {
      return undefined
    }
    return entry
  }

  #setTripId(correlationId: string, tripId: string) {
    this.#tripIdMap.set(correlationId, {
      tripId,
      updatedAt: Date.now(),
    })
  }

  #deleteTripId(correlationId: string) {
    this.#tripIdMap.delete(correlationId)
  }

  #touchTripId(correlationId: string) {
    const existing = this.#tripIdMap.get(correlationId)
    if (!existing) {
      return
    }

    existing.updatedAt = Date.now()
  }

  #cleanupTripIdMap() {
    const cutoff = Date.now() - TRIP_ID_MAP_TTL_MS

    for (const [correlationId, entry] of this.#tripIdMap.entries()) {
      if (entry.updatedAt < cutoff) {
        this.#tripIdMap.delete(correlationId)
      }
    }
  }
}
