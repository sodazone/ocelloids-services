import { Kysely } from 'kysely'
import { decodeCursor, encodeCursor } from '../../common/explorer.js'
import { QueryPagination } from '../../types.js'
import { TransfersFilters } from '../types.js'
import { IcTransfer, IntrachainTransfersDatabase, NewIcTransfer } from './types.js'

const MAX_LIMIT = 100

export class IntrachainTransfersRepository {
  readonly #db: Kysely<IntrachainTransfersDatabase>

  constructor(db: Kysely<IntrachainTransfersDatabase>) {
    this.#db = db
  }

  async insertTransfer(transfer: NewIcTransfer): Promise<IcTransfer> {
    const inserted = await this.#db
      .insertInto('ic_transfers')
      .values(transfer)
      .returningAll()
      .executeTakeFirst()

    if (!inserted) {
      throw new Error('Failed to insert transfer')
    }

    return inserted
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
    const paginatedTransfers = hasNextPage ? rows.slice(0, limit) : rows
    const endCursor = paginatedTransfers.length > 0 ? encodeCursor(paginatedTransfers) : ''

    return {
      nodes: paginatedTransfers,
      pageInfo: {
        hasNextPage,
        endCursor,
      },
    }
  }
}
