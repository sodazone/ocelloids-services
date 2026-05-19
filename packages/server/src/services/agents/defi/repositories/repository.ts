import { Kysely } from 'kysely'
import { SQLDialect } from '@/services/persistence/kysely/db.js'
import { DefiEventPayload, DefiLiquidityAsset, DefiLiquidityPayload, MoneyMarketPayload } from '../types.js'
import { DefiDatabase, DefiPool, NewDefiEventAsset, NewDefiPoolAsset } from './types.js'
import { calculateBorrowedUsd, calculateSuppliedUsd } from './util.js'

export class DefiRepository {
  readonly #db: Kysely<DefiDatabase>
  readonly #dialect: SQLDialect

  constructor(db: Kysely<DefiDatabase>, dialect: SQLDialect = 'sqlite') {
    this.#db = db
    this.#dialect = dialect
  }

  async close() {
    await this.#db.destroy()
  }

  async upsertLiquidityData(payload: DefiLiquidityPayload): Promise<number> {
    return await this.#db.transaction().execute(async (trx) => {
      const lending = payload.lending
      const isLending = payload.category === 'money-market'

      const isPausedVal = this.#asBoolVal(lending?.isPaused)
      const canBorrowVal = this.#asBoolVal(lending?.canBorrow)

      let query = trx.insertInto('defi_pool').values({
        network: payload.networkId,
        protocol: payload.protocol,
        market_id: payload.marketId,
        category: payload.category,
        borrow_apr: lending?.borrowAPR ?? null,
        supply_apr: lending?.supplyAPR ?? null,
        is_paused: isPausedVal,
        can_borrow: canBorrowVal,
        borrow_cap: lending?.borrowCap ?? null,
        supply_cap: lending?.supplyCap ?? null,
        bad_debt_usd: lending?.health?.badDebtUSD ?? null,
      })

      if (isLending) {
        query = query.onConflict((oc) =>
          oc.columns(['network', 'protocol', 'market_id']).doUpdateSet({
            category: payload.category,
            borrow_apr: lending?.borrowAPR ?? null,
            supply_apr: lending?.supplyAPR ?? null,
            is_paused: isPausedVal,
            can_borrow: canBorrowVal,
            borrow_cap: lending?.borrowCap ?? null,
            supply_cap: lending?.supplyCap ?? null,
            bad_debt_usd: lending?.health?.badDebtUSD ?? null,
          }),
        )
      } else {
        query = query.onConflict((oc) => oc.columns(['network', 'protocol', 'market_id']).doNothing())
      }

      const pool = await query.returning('id').executeTakeFirstOrThrow()
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

  async insertDefiEvent(payload: DefiEventPayload): Promise<number> {
    return await this.#db.transaction().execute(async (trx) => {
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

  async getLatestPoolStates(): Promise<DefiLiquidityPayload[]> {
    const isSqlite = this.#dialect === 'sqlite'
    const aggregateFn = isSqlite ? 'json_group_array' : 'json_agg'
    const objectFn = isSqlite ? 'json_object' : 'json_build_object'

    const pools = await this.#db
      .selectFrom('defi_pool as p')
      .leftJoin('defi_pool_asset as pa', 'pa.pool_id', 'p.id')
      .select([
        'p.id',
        'p.network as networkId',
        'p.protocol',
        'p.market_id as marketId',
        'p.category',
        'p.borrow_apr as borrowApr',
        'p.supply_apr as supplyApr',
        'p.is_paused as isPaused',
        'p.can_borrow as canBorrow',
        'p.borrow_cap as borrowCap',
        'p.supply_cap as supplyCap',
        'p.bad_debt_usd as badDebtUsd',
        (eb) =>
          eb
            .fn(aggregateFn, [
              eb.fn(objectFn, [
                eb.val('assetId'),
                eb.ref('pa.asset_id'),
                eb.val('symbol'),
                eb.ref('pa.symbol'),
                eb.val('decimals'),
                eb.ref('pa.decimals'),
                eb.val('priceUSD'),
                eb.ref('pa.price_usd'),
                eb.val('role'),
                eb.ref('pa.role'),
                eb.val('balances'),
                eb.fn(objectFn, [
                  eb.val('total'),
                  eb.ref('pa.balance_total'),
                  eb.val('available'),
                  eb.ref('pa.balance_available'),
                  eb.val('borrowed'),
                  eb.ref('pa.balance_borrowed'),
                  eb.val('reserves'),
                  eb.ref('pa.reserves'),
                ]),
              ]),
            ])
            .as('assets_raw'),
      ])
      .groupBy('p.id')
      .execute()

    return pools.map((pool) => {
      let parsedAssets: DefiLiquidityAsset[] = []

      if (pool.assets_raw) {
        // Postgres returns parsed objects directly; SQLite returns raw string representations
        parsedAssets =
          typeof pool.assets_raw === 'string'
            ? (JSON.parse(pool.assets_raw) as DefiLiquidityAsset[])
            : (pool.assets_raw as unknown as DefiLiquidityAsset[])

        if (parsedAssets.length === 1 && parsedAssets[0].assetId === null) {
          parsedAssets = []
        }
      }

      let suppliedUSD = 0
      let borrowedUSD = 0

      for (const asset of parsedAssets) {
        suppliedUSD += calculateSuppliedUsd(pool.category, asset)
        borrowedUSD += calculateBorrowedUsd(pool.category, asset)
      }

      const marketUtilization = suppliedUSD + borrowedUSD > 0 ? borrowedUSD / (suppliedUSD + borrowedUSD) : 0

      const lendingData: MoneyMarketPayload | undefined =
        pool.category === 'money-market'
          ? {
              utilization: Number(marketUtilization.toFixed(4)),
              borrowedUSD,
              borrowAPR: pool.borrowApr ? Number(pool.borrowApr) : 0,
              supplyAPR: pool.supplyApr ? Number(pool.supplyApr) : 0,
              isPaused: this.#asBool(pool.isPaused),
              canBorrow: this.#asBool(pool.canBorrow),
              borrowCap: pool.borrowCap ?? '0',
              supplyCap: pool.supplyCap ?? '0',
              health: {
                solvencyRatio: borrowedUSD > 0 ? suppliedUSD / borrowedUSD : 0,
                badDebtUSD: pool.badDebtUsd ? Number(pool.badDebtUsd) : 0,
              },
            }
          : undefined

      return {
        id: pool.id,
        type: 'liquidity',
        networkId: pool.networkId,
        protocol: pool.protocol,
        marketId: pool.marketId,
        category: pool.category as any,
        assets: parsedAssets,
        suppliedUSD,
        ...(lendingData && { lending: lendingData }),
      }
    })
  }

  async getEventsFromId(lastKnownId: number): Promise<
    Array<{
      id: number
      payload: DefiEventPayload
    }>
  > {
    const isSqlite = this.#dialect === 'sqlite'
    const aggregateFn = isSqlite ? 'json_group_array' : 'json_agg'
    const objectFn = isSqlite ? 'json_object' : 'json_build_object'

    const events = await this.#db
      .selectFrom('defi_event as e')
      .leftJoin('defi_event_asset as ea', 'ea.event_id', 'e.id')
      .select([
        'e.id',
        'e.network_id as networkId',
        'e.protocol',
        'e.market_id as marketId',
        'e.block_number as blockNumber',
        'e.tx_hash as txHash',
        'e.event_name as eventName',
        'e.actor_address as actorAddress',
        'e.lp_amount as lpAmount',
        (eb) =>
          eb
            .fn(aggregateFn, [
              eb.fn(objectFn, [
                eb.val('assetId'),
                eb.ref('ea.asset_id'),
                eb.val('symbol'),
                eb.ref('ea.symbol'),
                eb.val('amount'),
                eb.ref('ea.amount'),
                eb.val('amountUSD'),
                eb.ref('ea.amount_usd'),
                eb.val('direction'),
                eb.ref('ea.direction'),
              ]),
            ])
            .as('assets_raw'),
      ])
      .where('e.id', '>', lastKnownId)
      .groupBy('e.id')
      .orderBy('e.id', 'asc')
      .execute()

    return events.map((evt) => {
      let rawAssets: any[] = []

      if (evt.assets_raw) {
        rawAssets = typeof evt.assets_raw === 'string' ? JSON.parse(evt.assets_raw) : (evt.assets_raw as any)

        rawAssets = rawAssets.filter((a: any) => a.assetId !== null)
      }

      const eventName = evt.eventName as any
      let dataBlock: any = {}

      if (eventName === 'swap') {
        dataBlock = {
          origin: evt.actorAddress,
          in: rawAssets.filter((a) => a.direction === 'in'),
          out: rawAssets.filter((a) => a.direction === 'out'),
        }
      } else {
        dataBlock = {
          provider: evt.actorAddress,
          assets: rawAssets.filter((a) => a.direction === 'action'),
          ...(evt.lpAmount !== null && { lpAmount: evt.lpAmount }),
        }
      }

      return {
        id: evt.id,
        payload: {
          type: 'event',
          marketId: evt.marketId,
          protocol: evt.protocol,
          networkId: evt.networkId,
          blockNumber: evt.blockNumber,
          txHash: evt.txHash,
          name: eventName,
          data: dataBlock,
        } as DefiEventPayload,
      }
    })
  }

  #asBoolVal(v: boolean | undefined) {
    return v !== undefined ? (this.#dialect === 'sqlite' ? (v ? 1 : 0) : v) : null
  }

  #asBool(v: boolean | number | null | undefined) {
    return typeof v === 'number' ? v === 1 : (v ?? true)
  }
}
