import { Kysely, sql } from 'kysely'
import { SQLDialect } from '@/services/persistence/kysely/db.js'
import { decodeCursor, encodeCursor } from '../../common/explorer.js'
import { QueryPagination } from '../../types.js'
import {
  DefiDatabase,
  DefiDexPool,
  DefiDexPoolReserve,
  NewDefiDexPool,
  NewDefiDexPoolReserve,
  PoolKey,
} from './types.js'

const MAX_LIMIT = 50

export class DefiRepository {
  readonly #db: Kysely<DefiDatabase>

  constructor(db: Kysely<DefiDatabase>, _dialect: SQLDialect = 'sqlite') {
    this.#db = db
  }

  async close() {
    await this.#db.destroy()
  }

  /**
   * Insert pool
   */
  async insertPool(pool: NewDefiDexPool): Promise<DefiDexPool | null> {
    const inserted = await this.#db
      .insertInto('defi_dex_pool')
      .values(pool)
      .onConflict((oc) => oc.columns(['network', 'address']).doNothing())
      .returningAll()
      .executeTakeFirst()

    return inserted ?? null
  }

  async updatePoolReserves(poolKey: PoolKey, reserves: Array<NewDefiDexPoolReserve>): Promise<void> {
    if (!reserves.length) {
      return
    }

    await this.#db
      .with('pool', (db) =>
        db
          .selectFrom('defi_dex_pool')
          .select('id')
          .where('network', '=', poolKey.network)
          .where('protocol', '=', poolKey.protocol)
          .where('address', '=', poolKey.address),
      )
      .insertInto('defi_dex_pool_reserve')
      .values((eb) =>
        reserves.map((r) => ({
          ...r,
          pool_id: eb.selectFrom('pool').select('id'),
        })),
      )
      .onConflict((oc) =>
        oc.columns(['pool_id', 'asset_id']).doUpdateSet((eb) => ({
          balance: eb.ref('excluded.balance'),
          usd_value: eb.ref('excluded.usd_value'),
        })),
      )
      .execute()
  }

  async getPoolById(id: number): Promise<DefiDexPool> {
    const row = await this.#db.selectFrom('defi_dex_pool').selectAll().where('id', '=', id).executeTakeFirst()

    if (!row) {
      throw new Error(`Pool with id ${id} not found`)
    }

    return row
  }

  async getPoolReserves(poolId: number): Promise<Array<DefiDexPoolReserve>> {
    return await this.#db
      .selectFrom('defi_dex_pool_reserve')
      .selectAll()
      .where('id', '=', poolId)
      .orderBy('id', 'asc')
      .execute()
  }

  /**
   * Pool + reserves
   */
  async getPool(poolId: number) {
    const pool = await this.getPoolById(poolId)
    const reserves = await this.getPoolReserves(poolId)

    return { ...pool, reserves }
  }

  /**
   * Paginated pools
   * ordered by id desc
   */
  async listPools(
    filters?: {
      protocol?: string[]
      network?: string[]
      type?: string[]
      address?: string
      token?: string
    },
    pagination?: QueryPagination,
  ): Promise<{
    nodes: Array<DefiDexPool>
    pageInfo: {
      hasNextPage: boolean
      endCursor: string
    }
  }> {
    const limit = Math.min(pagination?.limit ?? 50, MAX_LIMIT)
    const queryLimit = limit + 1

    let query = this.#db.selectFrom('defi_dex_pool as p').selectAll('p')

    if (filters?.protocol?.length) {
      query =
        filters.protocol.length === 1
          ? query.where('p.protocol', '=', filters.protocol[0])
          : query.where('p.protocol', 'in', filters.protocol)
    }

    if (filters?.network?.length) {
      query =
        filters.network.length === 1
          ? query.where('p.network', '=', filters.network[0])
          : query.where('p.network', 'in', filters.network)
    }

    if (filters?.type?.length) {
      query =
        filters.type.length === 1
          ? query.where('p.type', '=', filters.type[0])
          : query.where('p.type', 'in', filters.type)
    }

    if (filters?.address) {
      query = query.where('p.address', '=', filters.address.toLowerCase())
    }

    /**
     * Pools containing token reserve
     */
    if (filters?.token) {
      query = query
        .innerJoin('defi_dex_pool_reserve as r', 'r.pool_id', 'p.id')
        .where('r.asset_id', '=', filters.token.toLowerCase())
        .groupBy('p.id')
    }

    if (pagination?.cursor) {
      const { timestamp: _unused, id } = decodeCursor(pagination.cursor)
      query = query.where('p.id', '<', id)
    }

    const rows = await query.orderBy('p.id', 'desc').limit(queryLimit).execute()

    const hasNextPage = rows.length > limit
    const nodes = hasNextPage ? rows.slice(0, limit) : rows

    const endCursor =
      nodes.length > 0
        ? encodeCursor([
            {
              id: nodes[nodes.length - 1].id,
              sent_at: 0,
            },
          ] as any)
        : ''

    return {
      nodes,
      pageInfo: {
        hasNextPage,
        endCursor,
      },
    }
  }

  async listProtocols() {
    const rows = (
      await sql<{ protocol: string }>`
        SELECT DISTINCT protocol
        FROM defi_dex_pool
        ORDER BY protocol ASC
      `.execute(this.#db)
    ).rows

    return {
      items: rows.map((r) => r.protocol),
      pageInfo: { hasNextPage: false, endCursor: '' },
    }
  }

  async listNetworks() {
    const rows = (
      await sql<{ network: string }>`
        SELECT DISTINCT network
        FROM defi_dex_pool
        ORDER BY network ASC
      `.execute(this.#db)
    ).rows

    return {
      items: rows.map((r) => r.network),
      pageInfo: { hasNextPage: false, endCursor: '' },
    }
  }

  async listTokens(pagination?: QueryPagination): Promise<{
    items: Array<{ asset: string; symbol?: string }>
    pageInfo: { hasNextPage: boolean; endCursor: string }
  }> {
    const limit = Math.min(pagination?.limit ?? 50, MAX_LIMIT)
    const queryLimit = limit + 1

    let afterId = Number.MAX_SAFE_INTEGER

    if (pagination?.cursor) {
      const decoded = decodeCursor(pagination.cursor)
      afterId = decoded.id
    }

    const rows = await this.#db
      .selectFrom('defi_dex_pool_reserve')
      .select(['id', 'asset_id', 'symbol'])
      .where('id', '<', afterId)
      .groupBy(['id', 'asset_id', 'symbol'])
      .orderBy('id', 'desc')
      .limit(queryLimit)
      .execute()

    const hasNextPage = rows.length > limit
    const items = hasNextPage ? rows.slice(0, limit) : rows

    const endCursor =
      items.length > 0
        ? encodeCursor([
            {
              id: items[items.length - 1].id,
              sent_at: 0,
            },
          ] as any)
        : ''

    return {
      items: items.map((r) => ({
        asset: r.asset_id,
        symbol: r.symbol ?? undefined,
      })),
      pageInfo: { hasNextPage, endCursor },
    }
  }
}
