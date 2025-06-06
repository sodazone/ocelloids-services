import { DuckDBInstance } from '@duckdb/node-api'

import { ControlQuery } from '@/common/index.js'
import { Logger } from '@/services/types.js'
import { Subscription, filter, mergeMap } from 'rxjs'
import { QueryParams, QueryResult } from '../../types.js'
import { XcmHumanizer } from '../humanize/index.js'
import { matchNotificationType, notificationTypeCriteria } from '../ops/criteria.js'
import { XcmTracker } from '../tracking.js'
import { HumanizedXcmPayload, XcmMessagePayload, XcmTerminusContext } from '../types.js'
import { DailyDuckDBExporter } from './repositories/exporter.js'
import { XcmTransfersRepository } from './repositories/transfers.js'
import { $XcmQueryArgs, NewXcmTransfer, XcmQueryArgs } from './types.js'

export class XcmAnalytics {
  readonly #log: Logger
  readonly #db: DuckDBInstance

  #repository?: XcmTransfersRepository
  #sub?: Subscription
  #exporter?: DailyDuckDBExporter
  #humanizer: XcmHumanizer

  constructor({ log, db, humanizer }: { log: Logger; db: DuckDBInstance; humanizer: XcmHumanizer }) {
    this.#db = db
    this.#log = log
    this.#humanizer = humanizer
  }

  async start(tracker: XcmTracker) {
    this.#log.info('[xcm:analytics] start')

    const dbConnection = await this.#db.connect()

    this.#repository = new XcmTransfersRepository(dbConnection)
    await this.#repository.migrate()

    this.#exporter = new DailyDuckDBExporter(this.#log, dbConnection)
    await this.#exporter.start()

    // XXX: experimental phantom subscription
    const typeCriteria = ControlQuery.from(notificationTypeCriteria(['xcm.received']))
    this.#sub = tracker.xcm$
      .pipe(
        filter((payload) => {
          return matchNotificationType(typeCriteria, payload.type)
        }),
        mergeMap((payload: XcmMessagePayload) => this.#humanizer.humanize(payload)),
      )
      .subscribe({
        next: (message) => {
          this.#onXcmReceived(message)
        },
        error: (error) => {
          this.#log.error(error, '[xcm:analytics] error on tracker stream')
        },
      })
  }

  stop() {
    this.#log.info('[xcm:analytics] stop')

    this.#sub?.unsubscribe()
    this.#repository?.close()
  }

  async query(params: QueryParams<XcmQueryArgs>): Promise<QueryResult> {
    if (this.#repository) {
      try {
        const { args } = params
        $XcmQueryArgs.parse(args)

        if (args.op === 'transfers_total') {
          return { items: await this.#repository.totalTransfers(args.criteria) }
        }

        if (args.op === 'transfers_count_series') {
          return { items: await this.#repository.transfers(args.criteria) }
        }

        if (args.op === 'transfers_volume_by_asset_series') {
          return { items: await this.#repository.volumeByAsset(args.criteria) }
        }

        if (args.op === 'transfers_by_channel_series') {
          return { items: await this.#repository.transfersByChannel(args.criteria) }
        }

        if (args.op === 'transfers_by_network') {
          return { items: await this.#repository.volumeByNetwork(args.criteria) }
        }
      } catch (error) {
        this.#log.error(error, '[xcm:analytics] error while executing a query')
      }
    }

    return { items: [] }
  }

  #onXcmReceived(message: HumanizedXcmPayload) {
    this.#fromXcmReceived(message)
      .then((transfers) => {
        for (const transfer of transfers) {
          try {
            this.#repository?.insert(transfer)
          } catch (error) {
            this.#log.error(error, '[xcm:analytics] error while inserting')
          }
        }
      })
      .catch((error: unknown) => {
        this.#log.error(error)
      })
  }

  async #fromXcmReceived(message: HumanizedXcmPayload): Promise<NewXcmTransfer[]> {
    const transfers: NewXcmTransfer[] = []

    const {
      origin,
      destination,
      messageId,
      humanized: { assets, from, to },
    } = message
    const recvAt = (destination as XcmTerminusContext).timestamp ?? Date.now()
    const sentAt = origin.timestamp ?? Date.now()

    for (const asset of assets) {
      transfers.push({
        from,
        to,
        recvAt,
        sentAt,
        volume: asset.volume,
        asset: asset.id,
        symbol: asset.symbol,
        decimals: asset.decimals,
        amount: asset.amount,
        origin: origin.chainId,
        destination: destination.chainId,
        correlationId: messageId ?? origin.messageHash,
      })
    }

    return transfers
  }
}
