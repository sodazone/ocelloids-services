import { SqliteError } from 'better-sqlite3'

import { asJSON, asPublicKey, deepCamelize, stringToUa8 } from '@/common/util.js'
import { BlockEvent } from '@/services/networking/substrate/index.js'
import { resolveDataPath } from '@/services/persistence/util.js'
import { Logger } from '@/services/types.js'
import { Twox256 } from '@polkadot-api/substrate-bindings'
import { Migrator } from 'kysely'
import { toHex } from 'polkadot-api/utils'
import { Subscription, concatMap } from 'rxjs'

import { QueryPagination, QueryResult, ServerSideEventsBroadcaster } from '../../types.js'
import { XcmHumanizer } from '../humanize/index.js'
import { HumanizedXcmAsset, XcmJourneyType } from '../humanize/types.js'
import { XcmTracker } from '../tracking.js'
import { HumanizedXcmPayload, XcmMessagePayload, XcmTerminusContext, isXcmReceived } from '../types/index.js'
import { JourneyFilters } from '../types/index.js'
import { createXcmDatabase } from './repositories/db.js'
import { XcmRepository, calculateTotalUsd } from './repositories/journeys.js'
import {
  FullXcmJourney,
  FullXcmJourneyResponse,
  ListAsset,
  NewXcmAsset,
  NewXcmJourney,
  XcmJourneyUpdate,
} from './repositories/types.js'

const ASSET_CACHE_REFRESH = 86_400_000 // 24 hours
const BACKFILL_MIN_TIME_AGO_MILLIS = 600_000
const hasBackfilling = process.env.OC_SUBSTRATE_BACKFILL_FILE !== undefined

const locks = new Map<string, Promise<void>>()

function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
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

function toStatus(payload: XcmMessagePayload) {
  if ('outcome' in payload.destination) {
    return payload.destination.outcome === 'Success' ? 'received' : 'failed'
  }
  if (payload.waypoint.outcome === 'Fail') {
    return 'failed'
  }
  if (payload.type === 'xcm.timeout') {
    return 'timeout'
  }
  if (['xcm.sent', 'xcm.relayed', 'xcm.hop'].includes(payload.type)) {
    return 'sent'
  }
  return 'unknown'
}

function asNewJourneyObject(
  newJourney: NewXcmJourney,
  assets: Omit<NewXcmAsset, 'journey_id'>[],
  id: number,
) {
  return deepCamelize<FullXcmJourney>({
    ...{
      ...newJourney,
      transactCalls: JSON.parse(newJourney.transact_calls),
      instructions: JSON.parse(newJourney.instructions),
      stops: JSON.parse(newJourney.stops),
    },
    assets,
    totalUsd: calculateTotalUsd(assets),
    id,
  })
}

function toStops(payload: XcmMessagePayload, existingStops: any[] = []): any[] {
  const updatedStops = payload.legs.map((leg, index) => {
    const existingStop = existingStops[index]

    const waypoint = payload.waypoint.legIndex === index ? payload.waypoint : null
    const event = waypoint?.event ? (waypoint.event as any) : undefined
    const extrinsic = event ? (event.extrinsic as any) : undefined
    const context = waypoint
      ? {
          chainId: waypoint.chainId,
          blockHash: waypoint.blockHash,
          blockNumber: waypoint.blockNumber,
          timestamp: waypoint.timestamp,
          status: waypoint.outcome,
          extrinsic: {
            blockPosition: waypoint.extrinsicPosition,
            hash: waypoint.extrinsicHash,
            module: extrinsic?.module,
            method: extrinsic?.method,
            evmTxHash: extrinsic?.evmTxHash,
          },
          event: {
            blockPosition: event?.blockPosition,
            module: event?.module,
            name: event?.name,
          },
          assetsTrapped: waypoint.assetsTrapped,
        }
      : null

    if (existingStop) {
      // Update existing stop with waypoint context
      if (waypoint) {
        if (existingStop.from.chainId === waypoint.chainId) {
          existingStop.from = { ...existingStop.from, ...context }
          existingStop.messageHash = waypoint.messageHash
          existingStop.messageId = waypoint.messageId ?? payload.messageId
          existingStop.instructions = waypoint.instructions
        } else if (existingStop.to.chainId === waypoint.chainId) {
          existingStop.to = { ...existingStop.to, ...context }
        } else if (existingStop.relay?.chainId === waypoint.chainId) {
          existingStop.relay = { ...existingStop.relay, ...context }
        }
      }
      return existingStop
    } else {
      // Create a new stop if no existing stop is found
      const isOutbound = leg.from === waypoint?.chainId
      return {
        type: leg.type,
        from: isOutbound ? context : { chainId: leg.from },
        to: leg.to === waypoint?.chainId ? context : { chainId: leg.to },
        relay: leg.relay === waypoint?.chainId ? context : leg.relay ? { chainId: leg.relay } : null,
        messageHash: isOutbound ? waypoint.messageHash : undefined,
        messageId: isOutbound ? (waypoint.messageId ?? payload.messageId) : undefined,
        instructions: isOutbound ? waypoint.instructions : undefined,
      }
    }
  })

  return updatedStops
}

function toCorrelationId(payload: XcmMessagePayload): string {
  const id = payload.messageId ?? payload.origin.messageHash

  return toHex(
    Twox256(
      stringToUa8(
        `${id}${payload.origin.chainId}${payload.origin.blockNumber}${payload.destination.chainId}`,
      ),
    ),
  )
}

function toEvmTxHash(payload: XcmMessagePayload): string | undefined {
  return (payload.origin.event as BlockEvent)?.extrinsic?.evmTxHash
}

function toNewJourney(payload: HumanizedXcmPayload): NewXcmJourney {
  return {
    correlation_id: toCorrelationId(payload),
    created_at: Date.now(),
    type: payload.humanized.type,
    destination: payload.destination.chainId,
    instructions: asJSON(payload.origin.instructions),
    transact_calls: asJSON(payload.humanized.transactCalls),
    origin: payload.origin.chainId,
    origin_extrinsic_hash: payload.origin.extrinsicHash,
    origin_evm_tx_hash: toEvmTxHash(payload),
    from: payload.humanized.from.key,
    to: payload.humanized.to.key,
    from_formatted: payload.humanized.from.formatted,
    to_formatted: payload.humanized.to.formatted,
    sent_at: payload.origin.timestamp,
    status: toStatus(payload),
    stops: asJSON(toStops(payload)),
  }
}

function toNewAssets(assets: HumanizedXcmAsset[]): Omit<NewXcmAsset, 'journey_id'>[] {
  return assets.map((asset) => ({
    symbol: asset.symbol,
    amount: asset.amount.toString(),
    asset: asset.id,
    decimals: asset.decimals,
    usd: asset.volume,
    role: asset.role,
    sequence: asset.sequence,
  }))
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

export class XcmExplorer {
  readonly #log: Logger
  readonly #humanizer: XcmHumanizer
  readonly #repository: XcmRepository
  readonly #migrator: Migrator
  readonly #broadcaster: ServerSideEventsBroadcaster

  #sub?: Subscription
  #assetCacheRefreshTask?: NodeJS.Timeout

  constructor({
    log,
    dataPath,
    humanizer,
    broadcaster,
  }: { log: Logger; dataPath?: string; humanizer: XcmHumanizer; broadcaster: ServerSideEventsBroadcaster }) {
    this.#log = log
    this.#humanizer = humanizer

    const filename = resolveDataPath('db.xcm-explorer.sqlite', dataPath)
    this.#log.info('[xcm:explorer] database at %s', filename)

    const { db, migrator } = createXcmDatabase(filename)
    this.#migrator = migrator
    this.#repository = new XcmRepository(db)
    this.#broadcaster = broadcaster
  }

  async start(tracker: XcmTracker) {
    this.#log.info('[xcm:explorer] start')

    await this.#migrator.migrateToLatest()

    if ((await this.#repository.getLastestSnapshot()) === undefined) {
      await this.#refreshAssetCache()
    }

    this.#assetCacheRefreshTask = setInterval(this.#refreshAssetCache.bind(this), ASSET_CACHE_REFRESH).unref()

    this.#sub = tracker
      .historicalXcm$({
        agent: 'xcm',
        timeframe: {
          start: Date.now() - 600_000,
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

    await this.#repository.close()
  }

  async listAssets(pagination?: QueryPagination): Promise<QueryResult<ListAsset>> {
    return await this.#repository.listAssets(pagination)
  }

  async listJourneys(
    filters?: JourneyFilters,
    pagination?: QueryPagination,
  ): Promise<QueryResult<FullXcmJourneyResponse>> {
    // convert address filters to public key for matching
    if (filters?.address) {
      filters.address = asPublicKey(filters.address)
    }
    const result = await this.#repository.listFullJourneys(filters, pagination)

    return {
      pageInfo: result.pageInfo,
      items: result.nodes.map((journey) => deepCamelize<FullXcmJourney>(journey)),
    }
  }

  async getJourneyById({ id }: { id: string }): Promise<QueryResult<FullXcmJourneyResponse>> {
    const journey = await this.#repository.getJourneyById(id)
    return journey ? { items: [deepCamelize<FullXcmJourney>(journey)] } : { items: [] }
  }

  async #onXcmMessage(message: XcmMessagePayload) {
    try {
      const correlationId = toCorrelationId(message)
      const existingJourney = await this.#repository.getJourneyById(correlationId)

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
          const journey = toNewJourney(humanizedXcm)
          const assets = toNewAssets(humanizedXcm.humanized.assets)
          try {
            const id = await this.#repository.insertJourneyWithAssets(journey, assets)
            this.#broadcastNewJourney(asNewJourneyObject(journey, assets, id))
          } catch (err: any) {
            if (err instanceof SqliteError && err.code === 'SQLITE_CONSTRAINT') {
              this.#log.warn('[xcm:explorer] Duplicate insert prevented for correlationId: %s', correlationId)
              return
            }
            throw err
          }

          break
        }

        case 'xcm.relayed': {
          if (existingJourney) {
            // Update the existing journey for xcm.relayed
            const updatedStops = toStops(message, existingJourney.stops)

            const updateWith: Partial<XcmJourneyUpdate> = {
              status: toStatus(message),
              stops: asJSON(updatedStops),
            }

            await this.#repository.updateJourney(existingJourney.id, updateWith)
            const { items } = await this.getJourneyById({ id: existingJourney.correlation_id })
            if (items.length > 0) {
              this.#broadcastUpdateJourney(items[0])
            }
            break
          }
          // Insert a new journey with assets if no existing journey
          const humanizedXcm = await this.#humanizer.humanize(message)

          const newJourney = toNewJourney(humanizedXcm)

          // Apply context from message.origin to the origin chain leg
          const originContext = {
            chainId: message.origin.chainId,
            blockHash: message.origin.blockHash,
            blockNumber: message.origin.blockNumber,
            timestamp: message.origin.timestamp,
            event: message.origin.event,
            extrinsicHash: message.origin.extrinsicHash,
            extrinsicPosition: message.origin.extrinsicPosition,
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

          const assets = toNewAssets(humanizedXcm.humanized.assets)
          try {
            const id = await this.#repository.insertJourneyWithAssets(newJourney, assets)
            this.#broadcastNewJourney(asNewJourneyObject(newJourney, assets, id))
          } catch (err: any) {
            if (err instanceof SqliteError && err.code === 'SQLITE_CONSTRAINT') {
              this.#log.warn('[xcm:explorer] Duplicate insert prevented for correlationId: %s', correlationId)
              return
            }
            throw err
          }
          break
        }

        case 'xcm.received':
        case 'xcm.hop':
        case 'xcm.bridge':
        case 'xcm.timeout': {
          if (!existingJourney) {
            this.#log.warn(
              '[xcm:explorer] Journey not found for correlationId: %s (%s)',
              correlationId,
              message.type,
            )
            return
          }

          const updatedStops = toStops(message, existingJourney.stops)
          const updateWith: Partial<XcmJourneyUpdate> = {
            status: toStatus(message),
            stops: asJSON(updatedStops),
          }
          // Update recv_at only for 'xcm.received'
          if (isXcmReceived(message)) {
            updateWith.recv_at = (message.destination as XcmTerminusContext).timestamp
          }
          await this.#repository.updateJourney(existingJourney.id, updateWith)

          const { humanized } = await this.#humanizer.humanize(message)

          if (humanized.type === XcmJourneyType.Swap) {
            const swapAssets = humanized.assets.filter((a) => a.role === 'swap_in' || a.role === 'swap_out')
            const assetUpdates = swapAssets.map((asset) =>
              this.#repository.updateAsset(existingJourney.id, asset, {
                amount: asset.amount.toString(),
                usd: asset.volume,
              }),
            )
            await Promise.all(assetUpdates)
          }

          const trappedAssets = toNewAssets(humanized.assets.filter((a) => a.role === 'trapped'))

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

          const { items } = await this.getJourneyById({ id: existingJourney.correlation_id })
          if (items.length > 0) {
            this.#broadcastUpdateJourney(items[0])
          }
          break
        }

        default:
          this.#log.warn('[xcm:explorer] Unhandled message %j', message)
      }
    } catch (error) {
      this.#log.error(error, 'Error processing XCM message %j', asJSON(message))
    }
  }

  #broadcastUpdateJourney(journey: FullXcmJourneyResponse) {
    this.#broadcastJourney('update_journey', journey)
  }

  #broadcastNewJourney(journey: FullXcmJourneyResponse) {
    this.#broadcastJourney('new_journey', journey)
  }

  #broadcastJourney(event: 'new_journey' | 'update_journey', data: FullXcmJourneyResponse) {
    if (shouldBroadcastJourney(data)) {
      this.#broadcaster.send({
        event,
        data,
      })
    }
  }

  async #refreshAssetCache() {
    try {
      await this.#repository.refreshAssetSnapshot()
      this.#log.info('[xcm:explorer] asset volume cache table refreshed')
    } catch (error) {
      this.#log.error(error, '[xcm:explorer] error on refreshing asset volume cache table')
    }
  }
}
