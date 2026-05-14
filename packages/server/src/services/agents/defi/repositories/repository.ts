import { Kysely } from 'kysely'
import { SQLDialect } from '@/services/persistence/kysely/db.js'
import { DefiEventPayload, DefiLiquidityPayload } from '../types.js'
import { DefiDatabase, DefiPool, NewDefiEventAsset, NewDefiPoolAsset } from './types.js'

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
        price_usd: asset.priceUSD,
        role: asset.role ?? null,
      }))

      if (assetRows.length > 0) {
        await trx.insertInto('defi_pool_asset').values(assetRows).execute()
      }

      return poolId
    })
  }

  async insertDefiEvent(db: Kysely<DefiDatabase>, payload: DefiEventPayload): Promise<number> {
    return await db.transaction().execute(async (trx) => {
      const underlyingPool = await trx
        .selectFrom('defi_pool')
        .select('id')
        .where('network', '=', payload.networkId)
        .where('protocol', '=', payload.protocol)
        .where('market_id', '=', payload.marketId)
        .executeTakeFirst()

      let actorAddress = ''
      let lpAmount: string | null = null
      const assetRowsToInsert: Omit<NewDefiEventAsset, 'event_id'>[] = []

      if (payload.name === 'swap') {
        actorAddress = payload.data.origin

        payload.data.in.forEach((asset) =>
          assetRowsToInsert.push({
            asset_id: asset.assetId,
            symbol: asset.symbol,
            amount: asset.amount,
            amount_usd: asset.amountUSD,
            direction: 'in',
          }),
        )

        payload.data.out.forEach((asset) =>
          assetRowsToInsert.push({
            asset_id: asset.assetId,
            symbol: asset.symbol,
            amount: asset.amount,
            amount_usd: asset.amountUSD,
            direction: 'out',
          }),
        )
      } else {
        actorAddress = payload.data.provider
        lpAmount = 'lpAmount' in payload.data ? (payload.data.lpAmount ?? null) : null

        payload.data.assets.forEach((asset) =>
          assetRowsToInsert.push({
            asset_id: asset.assetId,
            symbol: asset.symbol,
            amount: asset.amount,
            amount_usd: asset.amountUSD,
            direction: 'action',
          }),
        )
      }

      const insertedEvent = await trx
        .insertInto('defi_event')
        .values({
          pool_id: underlyingPool?.id ?? null,
          network_id: payload.networkId,
          protocol: payload.protocol,
          market_id: payload.marketId,
          block_number: payload.blockNumber,
          tx_hash: payload.txHash,
          event_name: payload.name,
          actor_address: actorAddress,
          lp_amount: lpAmount,
        })
        .returning('id')
        .executeTakeFirstOrThrow()

      if (assetRowsToInsert.length > 0) {
        const finalAssetRows = assetRowsToInsert.map((row) => ({
          ...row,
          event_id: insertedEvent.id,
        }))

        await trx.insertInto('defi_event_asset').values(finalAssetRows).execute()
      }

      return insertedEvent.id
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
