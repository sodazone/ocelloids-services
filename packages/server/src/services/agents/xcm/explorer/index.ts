import { SqliteError } from 'better-sqlite3'
import { LRUCache } from 'lru-cache'
import { concatMap, Subscription } from 'rxjs'
import { asJSON, deepCamelize } from '@/common/util.js'
import {
  CrosschainExplorer,
  CrosschainRepository,
  FullJourney,
  FullJourneyResponse,
  Journey,
  JourneyUpdate,
  NewAssetOperation,
  NewJourney,
} from '@/services/agents/crosschain/index.js'
import { Logger } from '@/services/types.js'
import { XcmHumanizer } from '../humanize/index.js'
import { XcmJourneyType } from '../humanize/types.js'
import { XcmTracker } from '../tracking/index.js'
import {
  HumanizedXcmPayload,
  isXcmHop,
  isXcmReceived,
  XcmMessagePayload,
  XcmTerminusContext,
} from '../types/index.js'
import { toCorrelationId, toNewAssets, toNewJourney, toStatus, toStops, toTrappedAssets } from './convert.js'
import { AssetUpdate, mergeAssets, mergeStops } from './xprotocol.js'

const BACKFILL_MIN_TIME_AGO_MILLIS = 600_000
const hasBackfilling = process.env.OC_SUBSTRATE_BACKFILL_FILE !== undefined

const locks = new Map<string, Promise<void>>()

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve()
  let resolve: () => void
  const next = new Promise<void>((r) => (resolve = r!))
  locks.set(
    key,
    prev.then(() => next),
  )

  return prev.then(async () => {
    try {
      return await fn()
    } finally {
      resolve!()
      if (locks.get(key) === next) {
        locks.delete(key)
      }
    }
  })
}

async function waitForAllLocks() {
  await Promise.all([...locks.values()])
}

function shouldBroadcastJourney({ sentAt, recvAt }: { sentAt?: number; recvAt?: number }): boolean {
  if (hasBackfilling) {
    const timeAgo = Date.now() - BACKFILL_MIN_TIME_AGO_MILLIS
    const isRecent =
      (sentAt !== undefined && sentAt >= timeAgo) || (recvAt !== undefined && recvAt >= timeAgo)
    return isRecent
  }
  return true
}

/**
 * XCM Explorer
 *
 * Specialized crosschain indexer for the Polkadot XCM protocol.
 * Uses the shared CrosschainExplorer for persistence and broadcasting.
 * Other protocols (e.g. Wormhole, LayerZero) will have their own explorers.
 */
export class XcmExplorer {
  readonly #log: Logger
  readonly #humanizer: XcmHumanizer
  readonly #crosschain: CrosschainExplorer
  readonly #repository: CrosschainRepository
  readonly #replacedJourneysCache: LRUCache<string, number>

  #sub?: Subscription
  #assetCacheRefreshTask?: NodeJS.Timeout

  constructor({
    log,
    humanizer,
    crosschain,
  }: { log: Logger; crosschain: CrosschainExplorer; humanizer: XcmHumanizer }) {
    this.#log = log
    this.#humanizer = humanizer
    this.#crosschain = crosschain
    this.#repository = crosschain.repository
    this.#replacedJourneysCache = new LRUCache({
      ttl: 3_600_000, // 1 hr
      ttlResolution: 60_000,
      ttlAutopurge: false,
      max: 1_000,
    })
  }

  async start(tracker: XcmTracker) {
    this.#log.info('[xcm:explorer] start')

    this.#sub = tracker
      .historicalXcm$({
        agent: 'xcm',
        timeframe: {
          start: Date.now() - 300_000,
        },
      })
      .pipe(
        concatMap((message) => {
          const correlationId = toCorrelationId(message)
          return withLock(correlationId, () => this.#onXcmMessage(message))
        }),
      )
      .subscribe({
        error: (error) => {
          this.#log.error(error, '[xcm:explorer] error on tracker stream')
        },
        complete: () => {
          this.#log.info('[xcm:explorer] tracker stream complete')
        },
      })
  }

  async stop() {
    this.#log.info('[xcm:explorer] stop')

    this.#sub?.unsubscribe()
    clearInterval(this.#assetCacheRefreshTask)

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Shutdown timeout waiting for locks')), 5000),
    )

    await Promise.race([waitForAllLocks(), timeout])
  }

  async #onXcmMessage(message: XcmMessagePayload) {
    try {
      const correlationId = toCorrelationId(message)
      if (this.#replacedJourneysCache.has(correlationId)) {
        await this.#updateReplacedJourneyStops(message, correlationId)
        return
      }
      const connectionId =
        message.origin.connectionId ??
        ('connectionId' in message.destination ? message.destination.connectionId : undefined)
      const tripId = connectionId
        ? this.#repository.generateTripId({ chainId: connectionId.chainId, values: [connectionId.data] })
        : undefined
      const existingTrips = await this.#repository.getJourneyByTripId(tripId)
      const existingJourney = await this.#repository.getJourneyByCorrelationId(correlationId)

      if (existingJourney && (existingJourney.status === 'received' || existingJourney.status === 'failed')) {
        this.#log.info('[xcm:explorer] Journey complete for correlationId: %s', correlationId)
        return
      }

      switch (message.type) {
        case 'xcm.sent': {
          if (existingJourney) {
            this.#log.info(
              '[xcm:explorer] Journey already exists for correlationId: %s (sent_at: %s)',
              correlationId,
              existingJourney.sent_at,
            )
            return
          }

          // Insert a new journey with assets if no existing journey
          const humanizedXcm = await this.#humanizer.humanize(message)
          const journey = toNewJourney(humanizedXcm, tripId)
          const assets = toNewAssets(humanizedXcm)

          try {
            // For Hydration-MRL / Wormhole, find duplicates and merge
            const { replacedJourneys } = await this.#dropXprotocolDuplicatesInNewJourney(
              message,
              journey,
              assets,
              humanizedXcm,
            )

            // Insert the new journey with assets
            const id = await this.#repository.insertJourneyWithAssets(journey, assets)

            for (const item of replacedJourneys) {
              await this.#repository.deleteJourney(item.id)
              this.#log.info(
                '[xcm:explorer] Journey deleted id=%s correlationId=%s',
                item.id,
                item.correlationId,
              )
              this.#crosschain.broadcastReplaceJourney({
                ids: { id, correlationId: journey.correlation_id },
                replaces: item,
              })
            }
            const fullJourney = await this.#repository.getJourneyById(id)
            if (fullJourney) {
              this.#broadcastNewJourney(deepCamelize<FullJourney>(fullJourney))

              if (existingTrips.length > 0) {
                this.#log.info(
                  '[xcm:connecting-trip] trip=%s journey=%s tripId=%s',
                  existingTrips.map((t) => t.id),
                  id,
                  tripId,
                )
                await this.#updateTripWithJourney(fullJourney, existingTrips)
              }
            }
          } catch (err: any) {
            if (err instanceof SqliteError && err.code === 'SQLITE_CONSTRAINT') {
              this.#log.warn('[xcm:explorer] Duplicate insert prevented for correlationId: %s', correlationId)
              return
            }
            throw err
          }

          return
        }

        case 'xcm.relayed': {
          if (existingJourney) {
            await this.#updateJourney(message, existingJourney)
            if (existingTrips.length > 0) {
              this.#log.info(
                '[xcm:connecting-trip] trip=%s journey=%s tripId=%s',
                existingTrips.map((t) => t.id),
                existingJourney.id,
                tripId,
              )
              this.#updateTripWithJourney(existingJourney, existingTrips)
              return
            }

            const { items } = await this.#crosschain.getJourneyById({ id: existingJourney.correlation_id })
            if (items.length > 0) {
              this.#broadcastUpdateJourney(items[0])
            }
            return
          }
          // Insert a new journey with assets if no existing journey
          const humanizedXcm = await this.#humanizer.humanize(message)

          const newJourney = toNewJourney(humanizedXcm, tripId)

          // Apply context from message.origin to the origin chain leg
          const originContext = {
            chainId: message.origin.chainId,
            blockHash: message.origin.blockHash,
            blockNumber: message.origin.blockNumber,
            timestamp: message.origin.timestamp,
            event: message.origin.event,
            extrinsicHash: message.origin.txHash,
            extrinsicPosition: message.origin.txPosition,
          }

          newJourney.stops = asJSON(
            toStops(
              {
                ...message,
                waypoint: {
                  ...originContext,
                  legIndex: 0,
                  outcome: 'Success',
                  instructions: null,
                  messageHash: message.origin.messageHash,
                },
              },
              JSON.parse(newJourney.stops),
            ),
          )

          const assets = toNewAssets(humanizedXcm)
          try {
            const id = await this.#repository.insertJourneyWithAssets(newJourney, assets)
            const fullJourney = await this.#repository.getJourneyById(id)
            if (fullJourney) {
              if (existingTrips.length > 0) {
                this.#log.info(
                  '[xcm:connecting-trip] trip=%s journey=%s tripId=%s',
                  existingTrips.map((t) => t.id),
                  id,
                  tripId,
                )
                this.#updateTripWithJourney(fullJourney, existingTrips)
                return
              }
              this.#broadcastNewJourney(deepCamelize<FullJourney>(fullJourney))
            }
          } catch (err: any) {
            if (err instanceof SqliteError && err.code === 'SQLITE_CONSTRAINT') {
              this.#log.warn('[xcm:explorer] Duplicate insert prevented for correlationId: %s', correlationId)
              return
            }
            throw err
          }
          return
        }

        case 'xcm.received':
        case 'xcm.hop':
        case 'xcm.bridge':
        case 'xcm.timeout': {
          if (!existingJourney) {
            if (existingTrips.length > 0) {
              this.#log.info(
                '[xcm:connecting-trip] trip=%s tripId=%s',
                existingTrips.map((t) => t.id),
                tripId,
              )
              await this.#updateTrip(message, existingTrips)
            }
            this.#log.warn(
              '[xcm:explorer] Journey not found for correlationId: %s (%s)',
              correlationId,
              message.type,
            )
            return
          }

          const { replacedJourneys, assetUpdates } = await this.#dropXprotocolDuplicates(
            message,
            existingJourney,
            null,
          )

          await this.#updateJourney(message, existingJourney)
          await this.#updateSwapAndTrapAssets(message, existingJourney)

          if (assetUpdates.length > 0) {
            await Promise.all(
              assetUpdates.map((a) =>
                this.#repository.updateAsset(
                  existingJourney.id,
                  { asset: a.asset, role: a.role, sequence: a.sequence },
                  { amount: a.amount, usd: a.usd },
                ),
              ),
            )
          }

          if (existingTrips.length > 0) {
            this.#log.info(
              '[xcm:connecting-trip] trip=%s journey=%s tripId=%s',
              existingTrips.map((t) => t.id),
              existingJourney.id,
              tripId,
            )
            await this.#updateTripWithJourney(existingJourney, existingTrips)
          } else {
            const { items } = await this.#crosschain.getJourneyById({ id: existingJourney.correlation_id })
            if (items.length > 0) {
              this.#broadcastUpdateJourney(items[0])
            }
          }

          for (const item of replacedJourneys) {
            await this.#repository.deleteJourney(item.id)
            this.#log.info(
              '[xcm:explorer] Journey deleted id=%s messageId=%s',
              item.id,
              item.stops[0].messageId,
            )
            this.#crosschain.broadcastReplaceJourney({
              ids: { id: existingJourney.id, correlationId: existingJourney.correlation_id },
              replaces: item,
            })
          }

          // On hop outs, check that we don't have any journeys stored that has the hop out as origin
          if (isXcmHop(message) && message.direction === 'out') {
            // Assign the waypoint to origin to get the correlation ID if hop out was emitted as origin sent message
            const cid = toCorrelationId({ ...message, origin: message.waypoint })
            const { items } = await this.#crosschain.getJourneyById({ id: cid })
            if (items.length > 0) {
              try {
                for (const i of items) {
                  await this.#repository.deleteJourney(i.id)
                }
                this.#log.info(
                  `[xcm:explorer] ${items.length} duplicate hop journeys deleted with correlation ID ${cid} and networkId ${message.waypoint.chainId}`,
                )
              } catch (error) {
                this.#log.error(
                  error,
                  `[xcm:explorer] Error deleting duplicate hop journeys with correlation ID ${cid}`,
                )
              }
            }
          }
          return
        }

        default:
          this.#log.warn('[xcm:explorer] Unhandled message %j', message)
      }
    } catch (error) {
      this.#log.error(error, 'Error processing XCM message %j', asJSON(message))
    }
  }

  async #updateTrip(message: XcmMessagePayload, existingTrips: Journey[]) {
    const existingTrip =
      existingTrips.length === 1
        ? existingTrips[0]
        : existingTrips.find((t) => t.origin_protocol !== t.destination_protocol)

    if (!existingTrip) {
      return
    }

    const updatedStops = toStops(message, existingTrip.stops)
    const updateWith: Partial<JourneyUpdate> = { stops: asJSON(updatedStops) }

    const isCrossProtocol = existingTrip.origin_protocol !== existingTrip.destination_protocol
    const isXcmOrigin = existingTrip.origin_protocol === 'xcm'
    const isXcmDestination = existingTrip.destination_protocol === 'xcm'

    if (!isCrossProtocol && isXcmOrigin) {
      // single-protocol XCM trip
      updateWith.status = toStatus(message)
      if (isXcmReceived(message)) {
        const dest = message.destination as XcmTerminusContext
        updateWith.recv_at = dest.timestamp
        if (dest.connectionId) {
          updateWith.trip_id = this.#repository.generateTripId({
            chainId: dest.connectionId.chainId,
            values: [dest.connectionId.data],
          })
        }
      }
    } else if (isCrossProtocol) {
      // cross-protocol trip
      if (isXcmOrigin) {
        updateWith.sent_at = message.origin.timestamp
      }
      if (isXcmDestination && isXcmReceived(message)) {
        const dest = message.destination as XcmTerminusContext
        updateWith.status = toStatus(message)
        updateWith.recv_at = dest.timestamp
        if (dest.connectionId) {
          updateWith.trip_id = this.#repository.generateTripId({
            chainId: dest.connectionId.chainId,
            values: [dest.connectionId.data],
          })
        }
      }
    }

    await this.#repository.updateJourney(existingTrip.id, updateWith)

    const updatedJourney = await this.#repository.getJourneyById(existingTrip.id)
    if (updatedJourney) {
      this.#broadcastUpdateJourney(deepCamelize<FullJourney>(updatedJourney))
    }
  }

  async #updateTripWithJourney(journey: FullJourney, existingTrips: Journey[]) {
    const existingTrip =
      existingTrips.length === 1
        ? existingTrips[0]
        : existingTrips.find((t) => t.origin_protocol !== t.destination_protocol)

    if (!existingTrip) {
      return
    }

    const merge = async (
      firstLegId: number,
      secondLegId: number,
    ): Promise<{ updatedIds: { id: number; correlationId: string }; replaces: Journey | null }> => {
      const { updated, deleted } = await this.#repository.mergeJourneys(
        firstLegId,
        secondLegId,
        existingTrip.trip_id,
      )
      this.#log.info(
        '[xcm:explorer] Journey merge updated=%s,%s deleted=%s,%s',
        updated.id,
        updated.correlationId,
        deleted?.id ?? 'null',
        deleted?.correlation_id ?? 'null',
      )
      return { updatedIds: { ...updated }, replaces: deleted }
    }

    try {
      const { origin_protocol, destination_protocol } = existingTrip

      let result: { updatedIds: { id: number; correlationId: string }; replaces: Journey | null } | null =
        null

      if (journey.origin_protocol !== journey.destination_protocol) {
        if (journey.origin_protocol === 'xcm') {
          result = await merge(journey.id, existingTrip.id)
        } else if (journey.destination_protocol === 'xcm') {
          result = await merge(existingTrip.id, journey.id)
        }
      } else if (origin_protocol === 'xcm' || existingTrip.origin === journey.origin) {
        result = await merge(journey.id, existingTrip.id)
      } else if (destination_protocol === 'xcm' || existingTrip.destination === journey.destination) {
        result = await merge(existingTrip.id, journey.id)
      }

      const updatedJourney = await this.#repository.getJourneyById(result?.updatedIds.id ?? journey.id)
      if (!updatedJourney) {
        return
      }

      this.#broadcastUpdateJourney(deepCamelize<FullJourney>(updatedJourney))

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
        this.#replacedJourneysCache.set(result.replaces.correlation_id, result.updatedIds.id)
      }
    } catch (e) {
      this.#log.error(e, '[xcm:connecting-trip] error %s', journey.id)
    }
  }

  async #updateJourney(message: XcmMessagePayload, existingJourney: FullJourney) {
    const updatedStops = toStops(message, existingJourney.stops)
    const updatedStatus = toStatus(message)

    const updateWith: Partial<JourneyUpdate> = {
      status: updatedStatus,
      stops: asJSON(updatedStops),
    }

    if (!isXcmReceived(message)) {
      await this.#repository.updateJourney(existingJourney.id, updateWith)
      return
    }

    const xcmDestination = message.destination as XcmTerminusContext

    if (xcmDestination.connectionId) {
      updateWith.trip_id = this.#repository.generateTripId({
        chainId: xcmDestination.connectionId.chainId,
        values: [xcmDestination.connectionId.data],
      })
    }

    if (
      existingJourney.destination_protocol === 'xcm' ||
      existingJourney.destination_protocol === 'snowbridge'
    ) {
      updateWith.recv_at = xcmDestination.timestamp
    } else if (updatedStatus !== 'failed') {
      // still in progress for non-xcm destinations
      updateWith.status = 'sent'
    }

    await this.#repository.updateJourney(existingJourney.id, updateWith)
  }

  async #updateSwapAndTrapAssets(message: XcmMessagePayload, existingJourney: FullJourney) {
    const { humanized } = await this.#humanizer.humanize(message)

    if (humanized.type === XcmJourneyType.Swap) {
      const swapAssets = humanized.assets.filter((a) => a.role === 'swap_in' || a.role === 'swap_out')
      const assetUpdates = swapAssets.map((asset) =>
        this.#repository.updateAsset(
          existingJourney.id,
          { asset: asset.id, role: asset.role, sequence: asset.sequence },
          {
            amount: asset.amount.toString(),
            usd: asset.volume,
          },
        ),
      )
      await Promise.all(assetUpdates)
    }

    const trappedAssets = toTrappedAssets(humanized.assets.filter((a) => a.role === 'trapped'))

    if (trappedAssets.length > 0) {
      const existingAssets = await this.#repository.getAssetIdentifiers(existingJourney.id)
      const existingKeySet = new Set(
        existingAssets.map((a) => `${a.asset}-${a.role ?? ''}-${a.sequence ?? ''}`),
      )
      const newAssets = trappedAssets.filter((asset) => {
        const key = `${asset.asset}-${asset.role ?? ''}-${asset.sequence ?? ''}`
        return !existingKeySet.has(key)
      })
      if (newAssets.length > 0) {
        await this.#repository.insertAssetsForJourney(existingJourney.id, newAssets)
      }
    }
  }

  #broadcastUpdateJourney(journey: FullJourneyResponse) {
    this.#broadcastJourney('update_journey', journey)
  }

  #broadcastNewJourney(journey: FullJourneyResponse) {
    this.#broadcastJourney('new_journey', journey)
  }

  #broadcastJourney(event: 'new_journey' | 'update_journey', data: FullJourneyResponse) {
    if (shouldBroadcastJourney(data)) {
      this.#crosschain.broadcastJourney(event, data)
    }
  }

  async #updateReplacedJourneyStops(message: XcmMessagePayload, correlationId: string) {
    this.#log.info('[xcm:explorer] Journey replaced for correlationId: %s', correlationId)
    if (isXcmReceived(message)) {
      const jid = this.#replacedJourneysCache.get(correlationId)!
      const trip = await this.#repository.getJourneyById(jid)
      if (!trip) {
        return
      }
      const stop = trip.stops.find(
        (s: any) => s.from.chainId === message.origin.chainId && s.to.chainId === message.destination.chainId,
      )
      if (!stop) {
        return
      }
      const stopInstructions: any[] = Array.isArray(stop.instructions)
        ? stop.instructions
        : stop.instructions
          ? [stop.instructions]
          : []

      stopInstructions.forEach((instr) => {
        if (
          instr.messageHash === message.waypoint.messageHash ||
          (instr.messageId && instr.messageId === message.messageId)
        ) {
          const outcome = message.waypoint.outcome
          instr.executedAt = {
            chainId: message.destination.chainId,
            outcome,
            event: message.waypoint.event,
          }

          if (outcome === 'Fail') {
            stop.status = outcome
          }
        }
      })

      const updateWith: Partial<JourneyUpdate> = {
        stops: asJSON(stop),
      }

      await this.#repository.updateJourney(jid, updateWith)

      this.#log.info('[xcm:explorer] Updated instructions executedAt for journey id=%s', trip.id)
    }
  }

  async #humanizeXprotocolPayload(
    message: XcmMessagePayload,
    humanizedXcm: HumanizedXcmPayload | null,
  ): Promise<HumanizedXcmPayload | null> {
    if (
      message.origin.chainId !== 'urn:ocn:polkadot:2034' ||
      message.destination.chainId !== 'urn:ocn:polkadot:2004'
    ) {
      return null
    }

    const hXcm = humanizedXcm ?? (await this.#humanizer.humanize(message))

    if (hXcm.humanized.xprotocolData?.type !== 'wormhole') {
      return null
    }

    return hXcm
  }

  async #dropXprotocolDuplicates(
    message: XcmMessagePayload,
    journey: FullJourney,
    humanizedXcm: HumanizedXcmPayload | null,
  ): Promise<{ replacedJourneys: FullJourneyResponse[]; assetUpdates: AssetUpdate[] }> {
    const replacedJourneys: FullJourneyResponse[] = []
    const assetUpdates: AssetUpdate[] = []

    const hXcm = await this.#humanizeXprotocolPayload(message, humanizedXcm)

    if (hXcm === null) {
      return { replacedJourneys, assetUpdates }
    }

    const { items } = await this.#crosschain.listJourneys({
      origins: [journey.origin],
      txHash: journey.origin_tx_primary,
    })

    for (const item of items) {
      if (
        item.from !== journey.from ||
        item.to !== hXcm.humanized.to.key ||
        item.destination !== hXcm.destination.chainId
      ) {
        continue
      }

      assetUpdates.push(...mergeAssets(journey.assets, item.assets))
      mergeStops(journey.stops, item.stops)

      replacedJourneys.push(item)
    }

    return { replacedJourneys, assetUpdates }
  }

  async #dropXprotocolDuplicatesInNewJourney(
    message: XcmMessagePayload,
    journey: NewJourney,
    assets: Omit<NewAssetOperation, 'journey_id'>[],
    humanizedXcm: HumanizedXcmPayload | null,
  ): Promise<{ replacedJourneys: FullJourneyResponse[]; assetUpdates: AssetUpdate[] }> {
    const replacedJourneys: FullJourneyResponse[] = []
    const assetUpdates: AssetUpdate[] = []

    const hXcm = await this.#humanizeXprotocolPayload(message, humanizedXcm)

    if (hXcm === null) {
      return { replacedJourneys, assetUpdates }
    }

    const { items } = await this.#crosschain.listJourneys({
      origins: [journey.origin],
      txHash: journey.origin_tx_primary,
    })
    const journeyStops = JSON.parse(journey.stops)
    for (const item of items) {
      if (
        item.from !== journey.from ||
        item.to !== hXcm.humanized.to.key ||
        item.destination !== hXcm.destination.chainId
      ) {
        continue
      }

      assetUpdates.push(...mergeAssets(assets, item.assets))
      mergeStops(journeyStops, item.stops)

      replacedJourneys.push(item)
    }

    journey.stops = asJSON(journeyStops)
    return { replacedJourneys, assetUpdates }
  }
}
