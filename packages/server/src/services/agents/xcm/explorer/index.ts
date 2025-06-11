import { DeepCamelize, asJSON, asPublicKey, deepCamelize } from '@/common/util.js'
import { BlockEvent } from '@/services/networking/substrate/index.js'
import { resolveDataPath } from '@/services/persistence/util.js'
import { Logger } from '@/services/types.js'
import { Migrator } from 'kysely'
import { Subscription, concatMap } from 'rxjs'
import { QueryPagination, QueryResult } from '../../types.js'
import { XcmHumanizer } from '../humanize/index.js'
import { XcmAsset } from '../humanize/types.js'
import { XcmTracker } from '../tracking.js'
import { HumanizedXcmPayload, XcmMessagePayload, XcmTerminusContext, isXcmReceived } from '../types/index.js'
import { JourneyFilters } from '../types/index.js'
import { createXcmDatabase } from './repositories/db.js'
import { XcmRepository } from './repositories/journeys.js'
import { FullXcmJourney, NewXcmAsset, NewXcmJourney, XcmJourneyUpdate } from './repositories/types.js'

function toStatus(payload: XcmMessagePayload) {
  if (payload.waypoint.outcome === 'Fail') {
    return 'failed'
  }
  if (payload.type === 'xcm.timeout') {
    return 'timeout'
  }
  if ('outcome' in payload.destination && payload.destination.outcome === 'Success') {
    return 'received'
  }
  if (['xcm.sent', 'xcm.relayed'].includes(payload.type)) {
    return 'sent'
  }
  return 'unknown'
}

function toStops(payload: XcmMessagePayload, existingStops: any[] = []): any[] {
  const updatedStops = payload.legs.map((leg, index) => {
    const existingStop = existingStops[index]

    const waypoint = payload.waypoint && payload.waypoint.legIndex === index ? payload.waypoint : null
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
        }
      : null

    if (existingStop) {
      // Update existing stop with waypoint context
      if (waypoint) {
        if (existingStop.from.chainId === waypoint.chainId) {
          existingStop.from = { ...existingStop.from, ...context }
        } else if (existingStop.to.chainId === waypoint.chainId) {
          existingStop.to = { ...existingStop.to, ...context }
        } else if (existingStop.relay?.chainId === waypoint.chainId) {
          existingStop.relay = { ...existingStop.relay, ...context }
        }
      }
      return existingStop
    } else {
      // Create a new stop if no existing stop is found
      return {
        type: leg.type,
        from: leg.from === waypoint?.chainId ? context : { chainId: leg.from },
        to: leg.to === waypoint?.chainId ? context : { chainId: leg.to },
        relay: leg.relay === waypoint?.chainId ? context : leg.relay ? { chainId: leg.relay } : null,
      }
    }
  })

  return updatedStops
}

function toCorrelationId(payload: XcmMessagePayload): string {
  return payload.messageId ?? payload.origin.messageHash
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

function toNewAssets(assets: XcmAsset[]): Omit<NewXcmAsset, 'journey_id'>[] {
  return assets.map((asset) => ({
    symbol: asset.symbol,
    amount: asset.amount.toString(),
    asset: asset.id,
    decimals: asset.decimals,
    usd: asset.volume,
  }))
}

export class XcmExplorer {
  readonly #log: Logger
  readonly #humanizer: XcmHumanizer
  readonly #repository: XcmRepository
  readonly #migrator: Migrator

  #sub?: Subscription

  constructor({ log, dataPath, humanizer }: { log: Logger; dataPath?: string; humanizer: XcmHumanizer }) {
    this.#log = log
    this.#humanizer = humanizer

    const filename = resolveDataPath('db.xcm-explorer.sqlite', dataPath)
    this.#log.info('[xcm:explorer] database at %s', filename)

    const { db, migrator } = createXcmDatabase(filename)
    this.#migrator = migrator
    this.#repository = new XcmRepository(db)
  }

  async start(tracker: XcmTracker) {
    this.#log.info('[xcm:explorer] start')

    await this.#migrator.migrateToLatest()

    this.#sub = tracker.xcm$
      // .historicalXcm$({
      //   agent: 'xcm',
      //   timeframe: 'this_2_days',
      // })
      .pipe(
        concatMap(async (message) => {
          await this.#onXcmMessage(message)
        }),
      )
      .subscribe({
        error: (error) => {
          this.#log.error(error, '[xcm:explorer] error on tracker stream')
        },
      })
  }

  async stop() {
    this.#log.info('[xcm:explorer] stop')

    this.#sub?.unsubscribe()

    await this.#repository.close()
  }

  async listJourneys(
    filters?: JourneyFilters,
    pagination?: QueryPagination,
  ): Promise<QueryResult<DeepCamelize<FullXcmJourney>>> {
    // convert address filters to public key for matching
    if (filters?.address) {
      filters.address = asPublicKey(filters.address)
    }
    const result = await this.#repository.listFullJourneys(filters, pagination)

    return {
      pageInfo: {
        hasNextPage: result.pageInfo.hasNextPage,
        endCursor: result.pageInfo.endCursor,
      },
      items: result.nodes.map((journey) => deepCamelize<FullXcmJourney>(journey)),
    }
  }

  async #onXcmMessage(message: XcmMessagePayload) {
    try {
      const correlationId = toCorrelationId(message)
      const existingJourney = await this.#repository.getJourneyByCorrelationId(correlationId)

      switch (message.type) {
        case 'xcm.sent': {
          if (existingJourney) {
            this.#log.info('[xcm:explorer] Journey already exists for correlationId: %s', correlationId)
            return
          }

          // Insert a new journey with assets if no existing journey
          const humanizedXcm = await this.#humanizer.humanize(message)
          await this.#repository.insertJourneyWithAssets(
            toNewJourney(humanizedXcm),
            toNewAssets(humanizedXcm.humanized.assets),
          )
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

          await this.#repository.insertJourneyWithAssets(
            newJourney,
            toNewAssets(humanizedXcm.humanized.assets),
          )
          break
        }

        case 'xcm.received':
        case 'xcm.hop':
        case 'xcm.bridge':
        case 'xcm.timeout': {
          if (!existingJourney) {
            this.#log.warn('[xcm:explorer] Journey not found for correlationId: %s', correlationId)
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
          break
        }

        default:
          this.#log.warn('[xcm:explorer] Unhandled message %j', message)
      }
    } catch (error) {
      this.#log.error(error, 'Error processing XCM message %j', asJSON(message))
    }
  }

  /*
  async #capture(message: XcmMessagePayload) {
    const filePath = './msgs.jsonl'
    let serializedMessage

    switch (message.type) {
      case 'xcm.sent':
      case 'xcm.relayed': {
        const humanizedXcm = await this.#humanizer.humanize(message)
        serializedMessage = asJSON(humanizedXcm)
        break
      }
      case 'xcm.received':

      case 'xcm.hop':
      case 'xcm.bridge':
      case 'xcm.timeout':
        serializedMessage = JSON.stringify(message)
    }

    try {
      writeFileSync(filePath, `${serializedMessage}\n`, { flag: 'a' }) // Append the message to the file
      this.#log.info('[xcm:explorer] Message written to %s', filePath)
    } catch (error) {
      this.#log.error(error, '[xcm:explorer] Failed to write message to file')
    }
  }
    */
}
