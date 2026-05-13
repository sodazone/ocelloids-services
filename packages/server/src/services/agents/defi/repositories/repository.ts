import { Kysely } from 'kysely'
import { SQLDialect } from '@/services/persistence/kysely/db.js'
import { DefiLiquidityPayload } from '../types.js'
import { DefiDatabase, DefiPool, NewDefiPoolAsset } from './types.js'

export class DefiRepository {
  readonly #db: Kysely<DefiDatabase>

  constructor(db: Kysely<DefiDatabase>, _dialect: SQLDialect = 'sqlite') {
    this.#db = db
  }

  async close() {
    await this.#db.destroy()
  }

  async upsertLiquidityData(network: string, payload: DefiLiquidityPayload): Promise<number> {
    return await this.#db.transaction().execute(async (trx) => {
      const pool = await trx
        .insertInto('defi_pool')
        .values({
          network,
          protocol: payload.protocol,
          market_id: payload.marketId,
          category: payload.category,
        })
        .onConflict((oc) =>
          oc.columns(['network', 'protocol', 'market_id']).doUpdateSet({ category: payload.category }),
        )
        .returning('id')
        .executeTakeFirstOrThrow()

      const poolId = pool.id

      await trx.deleteFrom('defi_pool_asset').where('pool_id', '=', poolId).execute()

      const assetRows: NewDefiPoolAsset[] = payload.assets.map((asset) => ({
        pool_id: poolId,
        asset_id: asset.assetId,
        symbol: asset.symbol,
        decimals: asset.decimals,
        balance_total: asset.balances.total ?? null,
        balance_available: asset.balances.available ?? null,
        balance_borrowed: asset.balances.borrowed ?? null,
        reserves: asset.balances.reserves,
        price_usd: asset.priceUSD !== undefined ? asset.priceUSD.toString() : null,
        role: asset.role ?? null,
      }))

      if (assetRows.length > 0) {
        await trx.insertInto('defi_pool_asset').values(assetRows).execute()
      }

      return poolId
    })
  }

  async getPoolById(id: number): Promise<DefiPool> {
    const row = await this.#db.selectFrom('defi_pool').selectAll().where('id', '=', id).executeTakeFirst()

    if (!row) {
      throw new Error(`Pool with id ${id} not found`)
    }

    return row
  }
}
