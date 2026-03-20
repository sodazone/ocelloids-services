import { Kysely, sql } from 'kysely'
import { fromHex } from 'polkadot-api/utils'
import { SQLDialect } from '@/services/persistence/kysely/db.js'
import { asDate, asNumber, bindValuesForDialect } from '@/services/persistence/kysely/val.js'
import { decodeCursor, encodeCursor } from '../../common/explorer.js'
import { QueryPagination } from '../../types.js'
import { TransferRangeFilters, TransfersFilters } from '../types.js'
import { IcTransfer, IntrachainTransfersDatabase, NewIcTransfer } from './types.js'

const MAX_LIMIT = 100

function encodeAssetsListCursor(
  row: { asset: string; usd_volume: number },
  snapshotStart: number,
  snapshotEnd: number,
): string {
  return Buffer.from(
    JSON.stringify({
      asset: row.asset,
      usd_volume: row.usd_volume,
      snapshotStart,
      snapshotEnd,
    }),
  ).toString('base64')
}

function decodeAssetsListCursor(cursor: string): {
  asset: string
  usd_volume: number
  snapshotStart: number
  snapshotEnd: number
} {
  return JSON.parse(Buffer.from(cursor, 'base64').toString())
}

export class IntrachainTransfersRepository {
  readonly #db: Kysely<IntrachainTransfersDatabase>
  readonly #dialect: SQLDialect

  constructor(db: Kysely<IntrachainTransfersDatabase>, dialect: SQLDialect = 'sqlite') {
    this.#db = db
    this.#dialect = dialect
  }

  async close() {
    await this.#db.destroy()
  }

  async insertTransfer(transfer: NewIcTransfer): Promise<IcTransfer | null> {
    const inserted = await this.#db
      .insertInto('ic_transfers')
      .values(bindValuesForDialect(transfer, this.#dialect))
      .onConflict((oc) => oc.column('transfer_hash').doNothing())
      .returningAll()
      .executeTakeFirst()

    return inserted ?? null
  }

  async getTransferById(id: number): Promise<IcTransfer> {
    const transfer = await this.#db
      .selectFrom('ic_transfers')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    if (!transfer) {
      throw new Error(`Transfer with id ${id} not found`)
    }

    return transfer
  }

  // List transfers in range of ids in ascending order
  async listTransfersByRange(
    filters: TransferRangeFilters,
    pagination?: QueryPagination,
  ): Promise<{
    nodes: Array<IcTransfer>
    pageInfo: {
      hasNextPage: boolean
      endCursor: string
    }
  }> {
    const limit = Math.min(pagination?.limit ?? 50, MAX_LIMIT)
    const queryLimit = limit + 1
    const cursor = pagination?.cursor ? decodeCursor(pagination.cursor) : undefined

    let query = this.#db.selectFrom('ic_transfers').selectAll()

    if (filters.start) {
      query = query.where('id', '>=', filters.start)
    }
    if (filters.end) {
      query = query.where('id', '<=', filters.end)
    }
    if (filters.networks) {
      query = query.where('network', 'in', filters.networks)
    }

    if (cursor) {
      query = query.where((eb) =>
        eb.or([
          eb('sent_at', '>', new Date(cursor.timestamp)),
          eb.and([eb('sent_at', '=', new Date(cursor.timestamp)), eb('ic_transfers.id', '>', cursor.id)]),
        ]),
      )
    }

    const rows = await query.orderBy('sent_at', 'asc').orderBy('id', 'asc').limit(queryLimit).execute()

    const hasNextPage = rows.length > limit
    const nodes = hasNextPage ? rows.slice(0, limit) : rows
    const endCursor = nodes.length > 0 ? encodeCursor(nodes as any[]) : ''

    return {
      nodes,
      pageInfo: {
        hasNextPage,
        endCursor,
      },
    }
  }

  async listTransfers(
    filters?: TransfersFilters,
    pagination?: QueryPagination,
  ): Promise<{
    nodes: Array<IcTransfer>
    pageInfo: {
      hasNextPage: boolean
      endCursor: string
    }
  }> {
    const limit = Math.min(pagination?.limit ?? 50, MAX_LIMIT)
    const queryLimit = limit + 1

    let query = this.#db.selectFrom('ic_transfers').selectAll()

    if (filters?.txHash) {
      const txHashBlob = fromHex(filters.txHash)

      query = query.where((qb) =>
        qb.or([qb('tx_primary', '=', txHashBlob), qb('tx_secondary', '=', txHashBlob)]),
      )
    }

    if (filters?.types?.length) {
      query = query.where('type', 'in', filters.types)
    }

    if (filters?.networks?.length) {
      query = query.where('network', 'in', filters.networks)
    }

    if (filters?.assets?.length) {
      query = query.where('asset', 'in', filters.assets)
    }

    if (filters?.usdAmountGte !== undefined) {
      query = query.where('usd', '>=', filters.usdAmountGte)
    }

    if (filters?.usdAmountLte !== undefined) {
      query = query.where('usd', '<=', filters.usdAmountLte)
    }

    if (filters?.sentAtGte !== undefined) {
      query = query.where('sent_at', '>=', new Date(filters.sentAtGte))
    }

    if (filters?.sentAtLte !== undefined) {
      query = query.where('sent_at', '<=', new Date(filters.sentAtLte))
    }

    if (filters?.address) {
      const addr = filters.address.toLowerCase()

      const apply = (qb: any, column: 'from' | 'to') => {
        if (addr.length > 42) {
          const prefix = addr.slice(0, 42)
          return qb.where(column, 'like', `${prefix}%`)
        } else {
          return qb.where(column, '=', addr)
        }
      }

      const baseQuery = query

      const fromQuery = apply(baseQuery, 'from')
      const toQuery = apply(baseQuery, 'to')

      query = fromQuery.unionAll(toQuery)
    }

    if (pagination?.cursor) {
      const { timestamp, id } = decodeCursor(pagination.cursor)

      query = query.where(() => sql`(sent_at, id) < (${timestamp}, ${id})`)
    }

    const rows = await query.orderBy('sent_at', 'desc').orderBy('id', 'desc').limit(queryLimit).execute()

    const hasNextPage = rows.length > limit
    const nodes = hasNextPage ? rows.slice(0, limit) : rows
    const endCursor = nodes.length > 0 ? encodeCursor(nodes) : ''

    return {
      nodes,
      pageInfo: {
        hasNextPage,
        endCursor,
      },
    }
  }

  async listNetworks() {
    const rows = await this.#db
      .selectFrom('ic_transfers')
      .select('network')
      .distinct()
      .orderBy('network', 'asc')
      .execute()

    return {
      items: rows.map((r) => r.network),
      pageInfo: { hasNextPage: false, endCursor: '' },
    }
  }

  async getLatestSnapshot() {
    return await this.#db
      .selectFrom('ic_asset_volume_cache')
      .select(['snapshot_start', 'snapshot_end'])
      .orderBy('snapshot_end', 'desc')
      .limit(1)
      .executeTakeFirst()
  }

  async refreshAssetSnapshot(): Promise<void> {
    try {
      const snapshot_end = new Date()
      const snapshot_start = new Date(snapshot_end.getTime() - 30 * 24 * 60 * 60 * 1000)

      const results = await this.#db
        .selectFrom('ic_transfers')
        .select((eb) => ['asset', 'symbol', eb.fn.coalesce(eb.fn.sum('usd'), eb.val(0)).as('usd_volume')])
        .where('type', '=', 'user')
        .where('sent_at', '>=', asDate(snapshot_start, this.#dialect))
        .where('sent_at', '<=', asDate(snapshot_end, this.#dialect))
        .groupBy(['asset', 'symbol'])
        .execute()

      if (results.length === 0) {
        return
      }

      await this.#db
        .insertInto('ic_asset_volume_cache')
        .values(
          results.map((r) =>
            bindValuesForDialect(
              {
                asset: r.asset,
                symbol: r.symbol,
                usd_volume: Number(r.usd_volume),
                snapshot_start,
                snapshot_end,
              },
              this.#dialect,
            ),
          ),
        )
        .onConflict((oc) =>
          oc.column('asset').doUpdateSet((eb) => ({
            symbol: eb.ref('excluded.symbol'),
            usd_volume: eb.ref('excluded.usd_volume'),
            snapshot_start: eb.ref('excluded.snapshot_start'),
            snapshot_end: eb.ref('excluded.snapshot_end'),
          })),
        )
        .execute()
    } catch (err) {
      console.error('Error refreshing IC asset snapshot:', err)
    }
  }

  async listAssets(pagination?: QueryPagination): Promise<{
    items: Array<{ asset: string; symbol?: string }>
    pageInfo: { hasNextPage: boolean; endCursor: string }
  }> {
    const limit = Math.min(pagination?.limit ?? 50, MAX_LIMIT)
    const queryLimit = limit + 1

    let snapshotStart: Date | number | undefined
    let snapshotEnd: Date | number | undefined
    let afterAsset: string | undefined
    let afterUsdVolume: number | undefined

    if (pagination?.cursor) {
      const decoded = decodeAssetsListCursor(pagination.cursor)
      snapshotStart = asDate(decoded.snapshotStart, this.#dialect)
      snapshotEnd = asDate(decoded.snapshotEnd, this.#dialect)
      afterAsset = decoded.asset
      afterUsdVolume = decoded.usd_volume
    }

    // Get latest snapshot if no cursor
    if (!snapshotStart || !snapshotEnd) {
      const latest = await this.getLatestSnapshot()
      if (!latest) {
        return { items: [], pageInfo: { hasNextPage: false, endCursor: '' } }
      }
      snapshotStart = latest.snapshot_start
      snapshotEnd = latest.snapshot_end
    }

    let query = this.#db
      .selectFrom('ic_asset_volume_cache')
      .select(['asset', 'symbol', 'usd_volume'])
      .where('snapshot_start', '=', snapshotStart)
      .where('snapshot_end', '=', snapshotEnd)

    // Cursor for pagination
    if (afterAsset && afterUsdVolume !== undefined) {
      query = query.where((eb) =>
        eb.or([
          eb('usd_volume', '<', afterUsdVolume),
          eb.and([eb('usd_volume', '=', afterUsdVolume), eb('asset', '>', afterAsset)]),
        ]),
      )
    }

    const rows = await query.orderBy('usd_volume', 'desc').orderBy('asset', 'asc').limit(queryLimit).execute()

    const hasNextPage = rows.length > limit
    const items = hasNextPage ? rows.slice(0, limit) : rows
    const endCursor = hasNextPage
      ? encodeAssetsListCursor(items[items.length - 1], asNumber(snapshotStart)!, asNumber(snapshotEnd)!)
      : ''

    return {
      items: items.map((r) => ({ asset: r.asset, symbol: r.symbol })),
      pageInfo: { hasNextPage, endCursor },
    }
  }
}
