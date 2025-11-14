import { mergeMap, Subscription } from 'rxjs'
import { asJSON, deepCamelize } from '@/common/util.js'
import { Logger, NetworkURN } from '@/services/types.js'
import { CrosschainExplorer } from '../crosschain/explorer.js'
import { CrosschainRepository, FullJourney, JourneyUpdate } from '../crosschain/index.js'
import { DataSteward } from '../steward/agent.js'
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
import { HYPERBRIDGE_NETWORK_ID, isBifrostOracle, isTokenGateway } from './config.js'
import { toHyperbridgeStops, toNewAssets, toNewJourney, toStatus } from './crosschain.js'
import { decodeAssetTeleportRequest, decodeOracleCall } from './decode.js'
import { HyperbridgeAssetsRegistry } from './registry/assets.js'
import { HyperbridgeTracker } from './tracking.js'
import { HyperbridgeDecodedPayload, HyperbridgeMessagePayload, HyperbridgeTerminusContext } from './types.js'

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
  readonly #ticker: TickerAgent
  readonly #tracker: HyperbridgeTracker
  readonly #registry: HyperbridgeAssetsRegistry
  readonly #subs: Subscription[] = []

  constructor(
    ctx: AgentRuntimeContext,
    deps: {
      ticker: TickerAgent
      steward: DataSteward
      crosschain: CrosschainExplorer
    },
  ) {
    this.#log = ctx.log
    this.#config = ctx.config ?? {}
    this.#crosschain = deps.crosschain
    this.#repository = deps.crosschain?.repository
    this.#ticker = deps.ticker
    this.#tracker = new HyperbridgeTracker(ctx)
    this.#registry = new HyperbridgeAssetsRegistry(ctx)

    this.#log.info('[agent:%s] created with config: %j', this.id, this.#config)
  }

  async start() {
    await this.#registry.start()
    await this.#tracker.start()

    this.#subs.push(
      this.#tracker.ismp$.pipe(mergeMap(this.#withDecodedPayload)).subscribe({
        next: (msg) => this.#onMessage(msg),
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

  async #withDecodedPayload(msg: HyperbridgeMessagePayload): Promise<HyperbridgeDecodedPayload> {
    try {
      if (isTokenGateway(msg.to)) {
        const decoded = decodeAssetTeleportRequest(msg.body)
        try {
          const { decimals, symbol } = await this.#registry.fetchMetadata(msg.origin.chainId, decoded.assetId)
          const price = await this.#fetchAssetPrice(HYPERBRIDGE_NETWORK_ID, decoded.assetId)
          return {
            ...msg,
            decoded: {
              ...decoded,
              decimals,
              symbol,
              usd: this.#calculateVolume({ amount: decoded.amount, decimals }, price),
            },
          }
        } catch (e) {
          this.#log.error(e, '[%s] Error fetching metadata', this.id)
          return {
            ...msg,
            decoded,
          }
        }
      }
      if (isBifrostOracle(msg.to)) {
        const decoded = decodeOracleCall(msg.body)
        return {
          ...msg,
          decoded,
        }
      }
      console.log('Message not decoded')
      // TODO: decode intent gateway requests
    } catch (err) {
      this.#log.error(
        err,
        `Unable to decode request body for ${msg.commitment} (${msg.waypoint.chainId} #${msg.waypoint.blockNumber})`,
      )
    }
    return msg
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

  #calculateVolume(asset: { amount: string; decimals?: number }, price: number | null): number | undefined {
    if (price === null || asset.decimals === undefined) {
      return
    }
    const normalizedAmount = Number(asset.amount) / 10 ** asset.decimals
    return normalizedAmount * price
  }

  #broadcast = async (event: 'new_journey' | 'update_journey', id: number) => {
    const fullJourney = await this.#repository.getJourneyById(id)
    if (!fullJourney) {
      // this.#telemetry.emit('telemetryWormholeError', { code: 'JOURNEY_NOT_FOUND', id: String(id) })

      throw new Error(`Failed to fetch ${id} journey after insert (${event})`)
    }
    this.#log.info('[agent:%s] broadcast %s:  %s', this.id, event, id)
    this.#crosschain.broadcastJourney(event, deepCamelize<FullJourney>(fullJourney))

    // this.#telemetry.emit('telemetryWormholeJourneyBroadcast', fullJourney)
  }

  async #onMessage(message: HyperbridgeDecodedPayload) {
    try {
      const correlationId = message.commitment
      const existingJourney = await this.#repository.getJourneyByCorrelationId(correlationId)

      if (existingJourney && (existingJourney.status === 'received' || existingJourney.status === 'failed')) {
        this.#log.info('[%s:explorer] Journey complete for correlationId: %s', this.id, correlationId)
        return
      }

      switch (message.type) {
        case 'ismp.dispatched': {
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
            const journey = toNewJourney(message)
            const assets = toNewAssets(message)

            const id = await this.#repository.insertJourneyWithAssets(journey, assets)
            this.#broadcast('new_journey', id)
          } catch (err) {
            this.#log.error(
              err,
              '[%s:explorer] Error inserting new journey for correlationId: %s',
              correlationId,
            )
          }

          break
        }
        case 'ismp.received':
        case 'ismp.relayed':
        case 'ismp.unmatched':
        case 'ismp.timeout': {
          if (!existingJourney) {
            this.#log.warn(
              '[%s:explorer] Journey not found for correlationId: %s (%s)',
              this.id,
              correlationId,
              message.type,
            )
            return
          }

          await this.#updateJourney(message, existingJourney)
          this.#broadcast('update_journey', existingJourney.id)

          break
        }
        default:
          this.#log.warn('[%s:explorer] Unhandled message %j', this.id, message)
      }
    } catch (error) {
      this.#log.error(error, '[%s: explorer] Error processing message %j', this.id, asJSON(message))
    }
  }

  async #updateJourney(message: HyperbridgeDecodedPayload, existingJourney: FullJourney) {
    const existingStops = Array.isArray(existingJourney.stops) ? existingJourney.stops : [existingJourney.stops]
    const updatedStops = toHyperbridgeStops(message, existingStops)
    const updateWith: Partial<JourneyUpdate> = {
      status: toStatus(message),
      stops: asJSON(updatedStops),
    }
    if (message.type === 'ismp.received') {
      const { timestamp, txHash, txHashSecondary } = message.destination as HyperbridgeTerminusContext
      updateWith.recv_at = timestamp
      ;(updateWith.destination_tx_primary = txHash), (updateWith.destination_tx_secondary = txHashSecondary)
    }
    await this.#repository.updateJourney(existingJourney.id, updateWith)
  }
}
