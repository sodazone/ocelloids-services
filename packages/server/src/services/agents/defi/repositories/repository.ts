import { Kysely } from 'kysely'
import { SQLDialect } from '@/services/persistence/kysely/db.js'
import { decodeCursor, encodeCursor } from '../../common/explorer.js'
import { fromWildcardOrArray, limitCap, paginatedResultsFromArray } from '../../common/query.js'
import { QueryPagination, QueryParams, QueryResult } from '../../types.js'
import {
  DefiAgentQueryArgs,
  DefiEventAction,
  DefiEventPayload,
  DefiLiquidityAsset,
  DefiLiquidityPayload,
  DefiOrder,
  DefiOrderFilters,
  DefiOrderPayload,
  DefiPricePayload,
  isLiquidationEvent,
  isSwapEvent,
  MoneyMarketPayload,
} from '../types.js'
import { DefiDatabase, DefiPool, NewDefiEventAsset, NewDefiOrder, NewDefiPoolAsset } from './types.js'
import { calculateBorrowedUsd, calculateSuppliedUsd } from './util.js'

function buildOrderKey(network: string, protocol: string, order_id: string) {
  return `${network}:${protocol}:${order_id}`
}

function addNumbericString(a: string, b: string) {
  return (Number(a) + Number(b)).toString()
}

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
        token_deficit_usd: lending?.health?.tokenDeficitUSD ?? null,
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
            token_deficit_usd: lending?.health?.tokenDeficitUSD ?? null,
          }),
        )
      } else {
        query = query.onConflict((oc) =>
          oc.columns(['network', 'protocol', 'market_id']).doUpdateSet({
            category: (eb) => eb.ref('defi_pool.category'),
          }),
        )
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

  async insertDefiEvent(payload: DefiEventPayload): Promise<void> {
    return await this.#db.transaction().execute(async (trx) => {
      const underlyingPool = await trx
        .selectFrom('defi_pool')
        .select('id')
        .where('network', '=', payload.networkId)
        .where('protocol', '=', payload.protocol)
        .where('market_id', '=', payload.marketId)
        .executeTakeFirst()

      let actorAddress = ''
      let counterparty: string | null = null
      const assetRowsToInsert: Omit<NewDefiEventAsset, 'event_id'>[] = []

      if (isSwapEvent(payload)) {
        actorAddress = payload.data.origin

        const assetIn = payload.data.in
        assetRowsToInsert.push({
          asset_id: assetIn.assetId,
          symbol: assetIn.symbol,
          amount: assetIn.amount,
          amount_usd: assetIn.amountUSD,
          role: 'swap_in',
        })

        const assetOut = payload.data.out
        assetRowsToInsert.push({
          asset_id: assetOut.assetId,
          symbol: assetOut.symbol,
          amount: assetOut.amount,
          amount_usd: assetOut.amountUSD,
          role: 'swap_out',
        })
      } else if (isLiquidationEvent(payload)) {
        actorAddress = payload.data.origin
        counterparty = payload.data.counterparty
        const debt = payload.data.debt
        const collateral = payload.data.collateral
        assetRowsToInsert.push({
          asset_id: debt.assetId,
          symbol: debt.symbol,
          amount: debt.amount,
          amount_usd: debt.amountUSD,
          role: 'lqd_debt',
        })
        assetRowsToInsert.push({
          asset_id: collateral.assetId,
          symbol: collateral.symbol,
          amount: collateral.amount,
          amount_usd: collateral.amountUSD,
          role: 'lqd_coll',
        })
      } else {
        actorAddress = payload.data.provider

        payload.data.assets.forEach((asset) =>
          assetRowsToInsert.push({
            asset_id: asset.assetId,
            symbol: asset.symbol,
            amount: asset.amount,
            amount_usd: asset.amountUSD,
            role: 'asset',
          }),
        )
      }

      await trx
        .insertInto('defi_event')
        .values({
          id: payload.id,
          pool_id: underlyingPool?.id ?? null,
          network_id: payload.networkId,
          protocol: payload.protocol,
          market_id: payload.marketId,
          block_number: payload.blockNumber,
          block_hash: payload.blockHash,
          tx_hash: payload.txHash,
          event_name: payload.name,
          actor_address: actorAddress ?? '',
          counterparty_address: counterparty ?? null,
        })
        .execute()

      if (assetRowsToInsert.length > 0) {
        const finalAssetRows = assetRowsToInsert.map((row) => ({
          ...row,
          event_id: payload.id,
        }))

        await trx.insertInto('defi_event_asset').values(finalAssetRows).execute()
      }
    })
  }

  async upsertDefiPrice(payload: DefiPricePayload) {
    return this.#db
      .insertInto('defi_price')
      .values({
        asset_id: payload.assetId,
        decimals: payload.decimals,
        network: payload.networkId,
        price_usd: payload.priceUSD,
        symbol: payload.symbol,
        updated_at: payload.updatedAt,
        protocol: payload.protocol,
      })
      .onConflict((oc: any) =>
        oc.columns(['network', 'protocol', 'asset_id']).doUpdateSet({
          price_usd: (eb: any) => eb.ref('excluded.price_usd'),
          updated_at: (eb: any) => eb.ref('excluded.updated_at'),
        }),
      )
      .execute()
  }

  async processOrderFill(payload: DefiOrderPayload) {
    const order_key = buildOrderKey(payload.networkId, payload.protocol, payload.orderId)
    const fill = payload.fill

    return this.#db.transaction().execute(async (trx) => {
      const existingOrder = await trx
        .selectFrom('defi_order')
        .select(['status', 'fill_count', 'filled_amount_in', 'filled_amount_out', 'filled_amount_usd'])
        .where('order_key', '=', order_key)
        .executeTakeFirst()

      if (existingOrder && !fill && payload.status !== existingOrder.status) {
        // Update order status
        await trx
          .updateTable('defi_order')
          .set({
            status: payload.status,
            updated_at: payload.timestamp,
            updated_at_block: payload.blockNumber,
          })
          .where('order_key', '=', order_key)
          .execute()

        return
      }

      if (!existingOrder) {
        // Create and insert new order
        let newOrder: NewDefiOrder
        const newOrderBase = {
          network: payload.networkId,
          protocol: payload.protocol,
          order_id: payload.orderId,
          order_key,
          owner: payload.owner,
          status: payload.status,
          fill_count: 0,
          filled_amount_in: '0',
          filled_amount_out: '0',
          filled_amount_usd: '0',
          updated_at_block: payload.blockNumber,
          updated_at: payload.timestamp,
        }

        if (!payload.creation) {
          if (!fill) {
            throw new Error(`No available data to create new order ${payload.orderId}`)
          }
          // Backfill order row with order fill info
          newOrder = {
            ...newOrderBase,
            asset_in: fill.assetIn,
            asset_out: fill.assetOut,
            symbol_in: fill.symbolIn,
            symbol_out: fill.symbolOut,
          }
        } else {
          newOrder = {
            ...newOrderBase,
            asset_in: payload.creation.assetIn,
            asset_out: payload.creation.assetOut,
            symbol_in: payload.creation.symbolIn,
            symbol_out: payload.creation.symbolOut,
            amount_in: payload.creation.amountIn ?? null,
            amount_out: payload.creation.amountOut ?? null,
            created_at: payload.creation.createdAt ?? null,
            created_block_number: payload.creation.createdAtBlock ?? null,
            created_block_hash: payload.creation.blockHash ?? null,
            created_tx_hash: payload.creation.txHash ?? null,
          }
        }

        await trx
          .insertInto('defi_order')
          .values(newOrder)
          .onConflict((oc) => oc.column('order_key').doNothing())
          .execute()
      }

      if (!fill) {
        return
      }

      // Insert order fill row
      const insertResult = await trx
        .insertInto('defi_order_fill')
        .values({
          order_key,
          filler: fill.filler ?? null,
          amount_in: fill.amountIn,
          amount_out: fill.amountOut,
          amount_usd: fill.amountUSD ?? null,
          tx_hash: fill.txHash ?? null,
          block_number: fill.blockNumber,
          block_hash: fill.blockHash,
          block_event_index: fill.eventIndex,
          timestamp: fill.timestamp,
        })
        .onConflict((oc) => oc.columns(['order_key', 'block_hash', 'block_event_index']).doNothing())
        .executeTakeFirst()

      const inserted = Number(insertResult.numInsertedOrUpdatedRows ?? 0) > 0

      if (!inserted) {
        return
      }

      // If new order fill inserted, update order data
      const prev = existingOrder ?? {
        fill_count: 0,
        filled_amount_in: '0',
        filled_amount_out: '0',
        filled_amount_usd: '0',
      }

      const nextFillCount = prev.fill_count + 1
      const nextIn = addNumbericString(prev.filled_amount_in, fill.amountIn)
      const nextOut = addNumbericString(prev.filled_amount_out, fill.amountOut)
      const nextUsd = fill.amountUSD
        ? addNumbericString(prev.filled_amount_usd, fill.amountUSD)
        : prev.filled_amount_usd

      await trx
        .updateTable('defi_order')
        .set({
          fill_count: nextFillCount,
          filled_amount_in: nextIn,
          filled_amount_out: nextOut,
          filled_amount_usd: nextUsd,
          status: payload.status,
          updated_at: fill.timestamp,
          updated_at_block: fill.blockNumber,
        })
        .where('order_key', '=', order_key)
        .execute()
    })
  }

  async getPoolById(id: number): Promise<DefiPool> {
    const row = await this.#db.selectFrom('defi_pool').selectAll().where('id', '=', id).executeTakeFirst()

    if (!row) {
      throw new Error(`Pool with id ${id} not found`)
    }

    return row
  }

  async getLatestPoolStates(
    params: QueryParams<DefiAgentQueryArgs>,
  ): Promise<QueryResult<DefiLiquidityPayload>> {
    if (params.args.op !== 'liquidity.last') {
      throw new Error('op must be liquidity.last')
    }

    const isSqlite = this.#dialect === 'sqlite'
    const aggregateFn = isSqlite ? 'json_group_array' : 'json_agg'
    const objectFn = isSqlite ? 'json_object' : 'json_build_object'

    const targetNetworks = fromWildcardOrArray(params.args.criteria?.networks)

    let query = this.#db
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
        'p.token_deficit_usd as tokenDeficitUsd',
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

    if (targetNetworks && targetNetworks.length > 0) {
      query = query.where('p.network', 'in', targetNetworks)
    }

    const pools = await query.groupBy('p.id').execute()

    return {
      items: pools.map((pool) => {
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

        const marketUtilization =
          suppliedUSD + borrowedUSD > 0 ? borrowedUSD / (suppliedUSD + borrowedUSD) : 0

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
                  tokenDeficitUSD: pool.tokenDeficitUsd ? Number(pool.tokenDeficitUsd) : 0,
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
      }),
    }
  }

  async findEvents(params: QueryParams<DefiAgentQueryArgs>): Promise<QueryResult<DefiEventPayload>> {
    if (params.args.op !== 'events') {
      throw new Error('op must be events')
    }

    const isSqlite = this.#dialect === 'sqlite'
    const aggregateFn = isSqlite ? 'json_group_array' : 'json_agg'
    const objectFn = isSqlite ? 'json_object' : 'json_build_object'

    const { pagination, args } = params
    const cursor = pagination?.cursor !== undefined ? pagination.cursor : ''
    const limit = limitCap(pagination)

    if (Number.isNaN(cursor)) {
      throw new TypeError('Pagination cursor must be a numeric string or number')
    }

    const networks = fromWildcardOrArray(args.criteria?.networks)
    const names = fromWildcardOrArray<DefiEventAction>(args.criteria?.filters?.events)

    let query = this.#db
      .selectFrom('defi_event as e')
      .leftJoin('defi_event_asset as ea', 'ea.event_id', 'e.id')
      .select([
        'e.id',
        'e.network_id as networkId',
        'e.protocol',
        'e.market_id as marketId',
        'e.block_number as blockNumber',
        'e.block_hash as blockHash',
        'e.tx_hash as txHash',
        'e.event_name as eventName',
        'e.actor_address as actorAddress',
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
                eb.val('role'),
                eb.ref('ea.role'),
              ]),
            ])
            .as('assets_raw'),
      ])
      .where('e.id', '>', cursor)

    if (networks && networks.length > 0) {
      query = query.where('e.network_id', 'in', networks)
    }

    if (names && names.length > 0) {
      query = query.where('e.event_name', 'in', names)
    }

    const events = await query
      .groupBy('e.id')
      .orderBy('e.id', 'asc')
      .limit(limit + 1)
      .execute()

    return paginatedResultsFromArray(
      events.map((evt) => {
        let rawAssets: any[] = []

        if (evt.assets_raw) {
          rawAssets =
            typeof evt.assets_raw === 'string' ? JSON.parse(evt.assets_raw) : (evt.assets_raw as any)

          rawAssets = rawAssets.filter((a: any) => a.assetId !== null)
        }

        const eventName = evt.eventName as any
        let dataBlock: any = {}

        if (eventName === 'swap') {
          dataBlock = {
            origin: evt.actorAddress,
            in: rawAssets.find((a) => a.role === 'swap_in'),
            out: rawAssets.find((a) => a.role === 'swap_out'),
          }
        } else {
          dataBlock = {
            provider: evt.actorAddress,
            assets: rawAssets,
          }
        }

        return {
          id: evt.id,
          type: 'event',
          marketId: evt.marketId,
          protocol: evt.protocol,
          networkId: evt.networkId,
          blockNumber: evt.blockNumber,
          blockHash: evt.blockHash,
          txHash: evt.txHash,
          name: eventName,
          data: dataBlock,
        }
      }),
      limit,
    )
  }

  async getLatestPrices(params: QueryParams<DefiAgentQueryArgs>): Promise<QueryResult<DefiPricePayload>> {
    if (params.args.op !== 'price.last') {
      throw new Error('op must be price.last')
    }

    const targetNetworks = fromWildcardOrArray(params.args.criteria.networks)

    const limit = params.pagination?.limit ?? 100
    const cursor = params.pagination?.cursor

    let query = this.#db
      .selectFrom('defi_price as p')
      .select([
        'p.id',
        'p.network',
        'p.protocol',
        'p.asset_id',
        'p.symbol',
        'p.decimals',
        'p.price_usd',
        'p.updated_at',
      ])

    if (targetNetworks?.length) {
      query = query.where('p.network', 'in', targetNetworks)
    }

    if (cursor) {
      if (Number.isNaN(cursor)) {
        throw new TypeError('Pagination cursor must be a numeric string or number')
      }
      query = query.where('p.id', '<', Number(cursor))
    }

    query = query.orderBy('p.id', 'desc').limit(limit + 1)

    const rows = await query.execute()

    const hasNextPage = rows.length > limit
    const items = hasNextPage ? rows.slice(0, limit) : rows

    const endCursor = items.length > 0 ? String(items[items.length - 1].id) : ''

    return {
      items: items.map((r) => ({
        type: 'price',
        networkId: r.network,
        protocol: r.protocol,
        assetId: r.asset_id,
        symbol: r.symbol,
        decimals: r.decimals,
        priceUSD: r.price_usd,
        updatedAt: r.updated_at,
      })),
      pageInfo: {
        endCursor,
        hasNextPage,
      },
    }
  }

  async listOrders(
    filters?: DefiOrderFilters,
    pagination?: QueryPagination,
  ): Promise<QueryResult<DefiOrder>> {
    const limit = limitCap(pagination)

    const cursor = pagination?.cursor ? decodeCursor(pagination.cursor) : null

    let query = this.#db.selectFrom('defi_order').selectAll()

    if (filters?.networks && filters.networks.length > 0) {
      query = query.where('network', 'in', filters.networks)
    }
    if (filters?.protocols && filters.protocols.length > 0) {
      query = query.where('protocol', 'in', filters.protocols)
    }
    if (filters?.status && filters.status.length > 0) {
      query = query.where('status', 'in', filters.status)
    }

    if (cursor) {
      query = query.where((eb) =>
        eb.or([
          eb('updated_at', '<', cursor.timestamp),
          eb.and([eb('updated_at', '=', cursor.timestamp), eb('id', '<', cursor.id)]),
        ]),
      )
    }

    const rows = await query
      .orderBy('updated_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit + 1)
      .execute()

    const hasNextPage = rows.length > limit

    const items = rows.slice(0, limit)

    return {
      items: items.map((row) => ({
        id: row.id,
        networkId: row.network,
        protocol: row.protocol,
        orderId: row.order_id,
        orderKey: row.order_key,
        owner: row.owner,

        assetIn: row.asset_in,
        assetOut: row.asset_out,
        symbolIn: row.symbol_in,
        symbolOut: row.symbol_out,
        amountIn: row.amount_in,
        amountOut: row.amount_out,
        fillCount: row.fill_count,
        filledAmountIn: row.filled_amount_in,
        filledAmountOut: row.filled_amount_out,
        filledAmountUsd: row.filled_amount_usd,

        status: row.status,

        created:
          row.created_block_number && row.created_at && row.created_block_hash
            ? {
                txHash: row.created_tx_hash,
                blockNumber: row.created_block_number,
                blockHash: row.created_block_hash,
                timestamp: row.created_at,
              }
            : undefined,

        updated: {
          blockNumber: row.updated_at_block,
          timestamp: row.updated_at,
        },
      })),

      pageInfo:
        hasNextPage && items.length > 0
          ? {
              endCursor: encodeCursor(
                items.map((i) => ({
                  sent_at: i.updated_at,
                  id: Number(i.id),
                })),
              ),
              hasNextPage: true,
            }
          : undefined,
    }
  }

  #asBoolVal(v: boolean | undefined) {
    return v !== undefined ? (this.#dialect === 'sqlite' ? (v ? 1 : 0) : v) : null
  }

  #asBool(v: boolean | number | null | undefined) {
    return typeof v === 'number' ? v === 1 : (v ?? true)
  }
}
