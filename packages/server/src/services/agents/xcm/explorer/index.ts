import { SqliteError } from 'better-sqlite3'
import { concatMap, Subscription } from 'rxjs'
import { asJSON } from '@/common/util.js'
import {
  CrosschainExplorer,
  CrosschainRepository,
  FullJourney,
  FullJourneyResponse,
  JourneyUpdate,
} from '@/services/agents/crosschain/index.js'
import { Logger } from '@/services/types.js'
import { XcmHumanizer } from '../humanize/index.js'
import { XcmJourneyType } from '../humanize/types.js'
import { isXcmHop, isXcmReceived, XcmMessagePayload, XcmTerminusContext } from '../types/index.js'
import {
  asNewJourneyObject,
  toCorrelationId,
  toNewAssets,
  toNewJourney,
  toStatus,
  toStops,
} from './convert.js'
import { XcmTracker } from '../tracking/index.js'

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
  }

  async start(tracker: XcmTracker) {
    this.#log.info('[xcm:explorer] start')

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
  }

  async #onXcmMessage(message: XcmMessagePayload) {
    try {
      const correlationId = toCorrelationId(message)
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
            await this.#updateJourney(message, existingJourney)

            const { items } = await this.#crosschain.getJourneyById({ id: existingJourney.correlation_id })
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

          await this.#updateJourney(message, existingJourney)

          await this.#updateSwapAndTrapAssets(message, existingJourney)

          const { items } = await this.#crosschain.getJourneyById({ id: existingJourney.correlation_id })
          if (items.length > 0) {
            this.#broadcastUpdateJourney(items[0])
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
          break
        }

        default:
          this.#log.warn('[xcm:explorer] Unhandled message %j', message)
      }
    } catch (error) {
      this.#log.error(error, 'Error processing XCM message %j', asJSON(message))
    }
  }

  async #updateJourney(message: XcmMessagePayload, existingJourney: FullJourney) {
    const updatedStops = toStops(message, existingJourney.stops)
    const updateWith: Partial<JourneyUpdate> = {
      status: toStatus(message),
      stops: asJSON(updatedStops),
    }
    // Update recv_at only for 'xcm.received'
    if (isXcmReceived(message)) {
      updateWith.recv_at = (message.destination as XcmTerminusContext).timestamp
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
}
