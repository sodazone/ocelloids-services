import { Kysely } from 'kysely'
import { decodeCursor, encodeCursor } from '../../common/explorer.js'
import { QueryPagination } from '../../types.js'
import { TransferRangeFilters, TransfersFilters } from '../types.js'
import { IcTransfer, IntrachainTransfersDatabase, NewIcTransfer } from './types.js'

const MAX_LIMIT = 100

export class IntrachainTransfersRepository {
  readonly #db: Kysely<IntrachainTransfersDatabase>

  constructor(db: Kysely<IntrachainTransfersDatabase>) {
    this.#db = db
  }

  async close() {
    await this.#db.destroy()
  }

  async insertTransfer(transfer: NewIcTransfer): Promise<IcTransfer | null> {
    const inserted = await this.#db
      .insertInto('ic_transfers')
      .values(transfer)
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

    let query = this.#db
      .selectFrom('ic_transfers')
      .selectAll()
      .where('id', '>=', filters.start)
      .where('id', '<=', filters.end)

    if (filters.networks) {
      query = query.where('network', 'in', filters.networks)
    }

    if (cursor) {
      query = query.where((eb) =>
        eb.or([
          eb('sent_at', '<', cursor.timestamp),
          eb.and([eb('sent_at', '=', cursor.timestamp), eb('ic_transfers.id', '<', cursor.id)]),
        ]),
      )
    }

    const rows = await query.orderBy('sent_at', 'desc').orderBy('id', 'desc').limit(queryLimit).execute()
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

    // cursor
    if (pagination?.cursor) {
      const { timestamp, id } = decodeCursor(pagination.cursor)
      query = query.where((eb) =>
        eb.or([
          eb('sent_at', '<', timestamp),
          eb.and([eb('sent_at', '=', timestamp), eb('ic_transfers.id', '<', id)]),
        ]),
      )
    }

    if (filters?.networks) {
      query = query.where('network', 'in', filters.networks)
    }

    if (filters?.assets) {
      query = query.where('asset', 'in', filters?.assets)
    }

    if (filters?.address) {
      if (filters.address.length > 42) {
        const addressPrefix = filters.address.slice(0, 42).toLowerCase()
        query = query.where((eb) =>
          eb.or([eb('from', 'like', `${addressPrefix}%`), eb('to', 'like', `${addressPrefix}%`)]),
        )
      } else {
        query = query.where((eb) =>
          eb.or([
            eb('from', '=', filters.address!.toLowerCase()),
            eb('to', '=', filters.address!.toLowerCase()),
          ]),
        )
      }
    }

    if (filters?.txHash) {
      query = query.where((qb) =>
        qb.or([qb('tx_primary', '=', filters.txHash), qb('tx_secondary', '=', filters.txHash)]),
      )
    }

    if (filters?.usdAmountGte !== undefined) {
      query = query.where('usd', '>=', filters.usdAmountGte)
    }

    if (filters?.usdAmountLte !== undefined) {
      query = query.where('usd', '<=', filters.usdAmountLte)
    }

    if (filters?.sentAtGte !== undefined) {
      query = query.where('sent_at', '>=', filters.sentAtGte)
    }

    if (filters?.sentAtLte !== undefined) {
      query = query.where('sent_at', '<=', filters.sentAtLte)
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
}
