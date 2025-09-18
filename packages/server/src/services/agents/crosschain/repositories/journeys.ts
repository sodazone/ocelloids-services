import { Buffer } from 'buffer'
import { QueryPagination } from '@/lib.js'
import { Kysely, SelectQueryBuilder, Transaction, sql } from 'kysely'
import { JourneyFilters } from '../types/queries.js'
import {
  AssetOperation,
  AssetOperationUpdate,
  AssetRole,
  CrosschainDatabase,
  FullJourney,
  FullJourneyAsset,
  JourneyUpdate,
  ListAsset,
  NewAssetOperation,
  NewJourney,
} from './types.js'

const MAX_LIMIT = 100

function encodeCursor(date: number | Date): string {
  const timestamp = typeof date === 'number' ? date : date.getTime() // Convert Date to Unix epoch
  return Buffer.from(timestamp.toString()).toString('base64') // Encode Unix epoch as Base64
}

function decodeCursor(cursor: string): number {
  return parseInt(Buffer.from(cursor, 'base64').toString('utf-8'), 10) // Decode Base64 to Unix epoch
}

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

export function calculateTotalUsd(assets: { usd?: number | null; role?: AssetRole }[]) {
  return assets.reduce((sum, row) => {
    if (row.role !== undefined && row.role !== 'transfer') {
      return sum
    }
    const usd = typeof row.usd === 'number' ? row.usd : Number(row.usd ?? 0)
    return sum + (isNaN(usd) ? 0 : usd)
  }, 0)
}

export class CrosschainRepository {
  readonly #db: Kysely<CrosschainDatabase>

  constructor(db: Kysely<CrosschainDatabase>) {
    this.#db = db
  }

  async updateJourney(id: number, updateWith: JourneyUpdate): Promise<void> {
    await this.#db.updateTable('xc_journeys').set(updateWith).where('id', '=', id).execute()
  }

  async getAssetIdentifiers(
    journeyId: number,
  ): Promise<Pick<AssetOperation, 'asset' | 'role' | 'sequence'>[]> {
    return this.#db
      .selectFrom('xc_asset_ops')
      .select(['asset', 'role', 'sequence'])
      .where('journey_id', '=', journeyId)
      .execute()
  }

  async updateAsset(
    journeyId: number,
    asset: Pick<AssetOperation, 'asset' | 'role' | 'sequence'>,
    updateWith: AssetOperationUpdate,
  ): Promise<void> {
    let query = this.#db
      .updateTable('xc_asset_ops')
      .set(updateWith)
      .where('journey_id', '=', journeyId)
      .where('asset', '=', asset.asset)

    if (asset.role !== undefined) {
      query = query.where('role', '=', asset.role)
    }

    if (asset.sequence !== undefined) {
      query = query.where('sequence', '=', asset.sequence)
    }

    await query.execute()
  }

  async getJourneyById(id: string): Promise<FullJourney | undefined> {
    const rows = await this.#db
      .selectFrom('xc_journeys')
      .selectAll('xc_journeys')
      .leftJoin('xc_asset_ops', 'xc_journeys.id', 'xc_asset_ops.journey_id')
      .select([
        'xc_asset_ops.asset',
        'xc_asset_ops.symbol',
        'xc_asset_ops.amount',
        'xc_asset_ops.decimals',
        'xc_asset_ops.usd',
        'xc_asset_ops.role',
        'xc_asset_ops.sequence',
      ])
      .where('xc_journeys.correlation_id', '=', id)
      .execute()

    if (rows.length === 0) {
      return undefined
    }

    const totalUsd = calculateTotalUsd(rows)

    const journey = {
      id: rows[0].id,
      correlation_id: rows[0].correlation_id,
      status: rows[0].status,
      type: rows[0].type,
      origin: rows[0].origin,
      destination: rows[0].destination,
      from: rows[0].from,
      to: rows[0].to,
      from_formatted: rows[0].from_formatted,
      to_formatted: rows[0].to_formatted,
      sent_at: rows[0].sent_at,
      recv_at: rows[0].recv_at,
      created_at: rows[0].created_at,
      stops: rows[0].stops,
      instructions: rows[0].instructions,
      transact_calls: rows[0].transact_calls,
      origin_extrinsic_hash: rows[0].origin_extrinsic_hash ?? undefined,
      origin_evm_tx_hash: rows[0].origin_evm_tx_hash ?? undefined,
      totalUsd,
      assets: rows
        .filter((row) => row.asset !== undefined && row.asset !== null)
        .map((row) => ({
          asset: row.asset ?? 'unknown',
          symbol: row.symbol ?? undefined,
          amount: row.amount ?? '0',
          decimals: row.decimals ?? undefined,
          usd: row.usd ?? undefined,
          role: row.role ?? undefined,
          sequence: row.sequence ?? undefined,
        })),
    }

    return journey
  }

  async deleteJourney(id: number): Promise<void> {
    await this.#db.deleteFrom('xc_journeys').where('id', '=', id).execute()
  }

  async insertJourneyWithAssets(
    journey: NewJourney,
    assets: Array<Omit<NewAssetOperation, 'journey_id'>>,
  ): Promise<number> {
    return await this.#db.transaction().execute(async (trx) => {
      const insertedJourney = await trx
        .insertInto('xc_journeys')
        .values(journey)
        .returning('id')
        .executeTakeFirst()

      if (!insertedJourney?.id) {
        throw new Error('Failed to insert journey')
      }

      const journeyId = insertedJourney.id

      await this.insertAssetsForJourney(journeyId, assets, trx)

      return journeyId
    })
  }

  async insertAssetsForJourney(
    journeyId: number,
    assets: Omit<NewAssetOperation, 'journey_id'>[],
    db: Kysely<CrosschainDatabase> | Transaction<CrosschainDatabase> = this.#db,
  ): Promise<void> {
    if (assets.length === 0) {
      return
    }
    const assetsWithJourneyId = assets.map((asset) => ({
      ...asset,
      journey_id: journeyId,
    }))

    await db.insertInto('xc_asset_ops').values(assetsWithJourneyId).execute()
  }

  async close() {
    await this.#db.destroy()
  }

  async refreshAssetSnapshot() {
    const snapshot_end = Date.now()
    const snapshot_start = snapshot_end - 30 * 24 * 60 * 60 * 1000

    // Subquery: sum usd per asset within snapshot window
    const volumeSubquery = this.#db
      .selectFrom('xc_asset_ops as recent_assets')
      .innerJoin('xc_journeys as recent_journeys', 'recent_assets.journey_id', 'recent_journeys.id')
      .select((eb) => [
        eb.ref('recent_assets.asset').as('asset'),
        eb.fn.sum(eb.fn.coalesce('recent_assets.usd', eb.val(0))).as('usd_volume'),
      ])
      .where('recent_journeys.sent_at', '>=', snapshot_start)
      .where('recent_journeys.sent_at', '<=', snapshot_end)
      .where('recent_journeys.status', '=', 'received')
      .groupBy('recent_assets.asset')
      .as('volumes')

    // Left join on all known assets
    const results = await this.#db
      .selectFrom('xc_asset_ops')
      .leftJoin(volumeSubquery, 'xc_asset_ops.asset', 'volumes.asset')
      .select((eb) => [
        eb.ref('xc_asset_ops.asset').as('asset'),
        eb.fn.max('xc_asset_ops.symbol').as('symbol'),
        eb.fn.coalesce(eb.ref('volumes.usd_volume'), eb.val(0)).as('usd_volume'),
      ])
      .where('xc_asset_ops.symbol', 'is not', null)
      .groupBy('xc_asset_ops.asset')
      .execute()

    // Upsert into snapshot table
    await this.#db
      .insertInto('xc_asset_volume_cache')
      .values(
        results.map((row) => ({ ...row, usd_volume: Number(row.usd_volume), snapshot_end, snapshot_start })),
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
  }

  async listAssets(pagination?: QueryPagination): Promise<{
    items: Array<ListAsset>
    pageInfo: {
      hasNextPage: boolean
      endCursor: string
    }
  }> {
    const limit = Math.min(pagination?.limit ?? MAX_LIMIT, MAX_LIMIT)

    let snapshotStart: number | undefined
    let snapshotEnd: number | undefined
    let afterAsset: string | undefined
    let afterUsdVolume: number | undefined

    if (pagination?.cursor) {
      const decoded = decodeAssetsListCursor(pagination.cursor)
      snapshotStart = decoded.snapshotStart
      snapshotEnd = decoded.snapshotEnd
      afterAsset = decoded.asset
      afterUsdVolume = decoded.usd_volume
    }

    // Fetch the current snapshot bounds if cursor is not provided
    if (!snapshotStart || !snapshotEnd) {
      const latestSnapshot = await this.getLastestSnapshot()

      if (!latestSnapshot) {
        return {
          items: [],
          pageInfo: {
            hasNextPage: false,
            endCursor: '',
          },
        }
      }

      snapshotStart = latestSnapshot.snapshot_start
      snapshotEnd = latestSnapshot.snapshot_end
    }

    let query = this.#db
      .selectFrom('xc_asset_volume_cache')
      .select(['asset', 'symbol', 'usd_volume'])
      .where('snapshot_start', '=', snapshotStart)
      .where('snapshot_end', '=', snapshotEnd)

    // Cursor filtering
    if (afterAsset && afterUsdVolume !== undefined) {
      query = query.where((eb) =>
        eb.or([
          eb('usd_volume', '<', afterUsdVolume),
          eb.and([eb('usd_volume', '=', afterUsdVolume), eb('asset', '>', afterAsset)]),
        ]),
      )
    }

    query = query
      .orderBy('usd_volume', 'desc')
      .orderBy('asset', 'asc')
      .limit(limit + 1)

    const rows = await query.execute()

    const hasNextPage = rows.length > limit
    const items = rows.slice(0, limit)

    const endCursor = hasNextPage
      ? encodeAssetsListCursor(items[items.length - 1], snapshotStart, snapshotEnd)
      : ''

    return {
      items: items.map((row) => ({
        asset: row.asset,
        symbol: row.symbol,
      })),
      pageInfo: {
        hasNextPage,
        endCursor,
      },
    }
  }

  async getLastestSnapshot() {
    return await this.#db
      .selectFrom('xc_asset_volume_cache')
      .select(['snapshot_start', 'snapshot_end'])
      .limit(1)
      .executeTakeFirst()
  }

  async listFullJourneys(
    filters?: JourneyFilters,
    pagination?: QueryPagination,
  ): Promise<{
    nodes: Array<FullJourney>
    pageInfo: {
      hasNextPage: boolean
      endCursor: string
    }
  }> {
    const limit = Math.min(pagination?.limit ?? 50, MAX_LIMIT)
    const realLimit = limit + 1

    // Determine whether we need to pre-filter via xcm_assets
    const useAssetSubquery = !!filters?.assets || !!filters?.usdAmountGte || !!filters?.usdAmountLte

    // STEP 1: Get paginated journey IDs
    const journeyIdsResult = useAssetSubquery
      ? await this.#filterJourneyIdsWithAssets(realLimit, filters, pagination?.cursor)
      : await this.#filterJourneyIds(realLimit, filters, pagination?.cursor)

    const hasNextPage = journeyIdsResult.length > limit
    const paginatedJourneys = hasNextPage ? journeyIdsResult.slice(0, limit) : journeyIdsResult
    const journeyIds = paginatedJourneys.map((j) => j.id)

    if (journeyIds.length === 0) {
      return {
        nodes: [],
        pageInfo: {
          hasNextPage: false,
          endCursor: '',
        },
      }
    }

    // STEP 2: Fetch full journey data
    const rows = await this.#getFullJourneyData(journeyIds)

    const nodes = rows.map((row) => ({
      id: row.id,
      correlation_id: row.correlation_id,
      status: row.status,
      type: row.type,
      origin: row.origin,
      destination: row.destination,
      from: row.from,
      to: row.to,
      from_formatted: row.from_formatted,
      to_formatted: row.to_formatted,
      sent_at: row.sent_at,
      recv_at: row.recv_at,
      created_at: row.created_at,
      stops: row.stops,
      instructions: row.instructions,
      transact_calls: row.transact_calls,
      origin_extrinsic_hash: row.origin_extrinsic_hash,
      origin_evm_tx_hash: row.origin_evm_tx_hash ?? undefined,
      totalUsd: typeof row.total_usd === 'number' ? row.total_usd : Number(row.total_usd ?? 0),
      assets: this.#parseAssets(row.assets),
    }))

    const endCursor = nodes.length > 0 ? encodeCursor(nodes[nodes.length - 1].sent_at) : ''

    return {
      nodes,
      pageInfo: {
        hasNextPage,
        endCursor,
      },
    }
  }

  #parseAssets(assets: any): FullJourneyAsset[] {
    try {
      const parsed = Array.isArray(assets) ? assets : typeof assets === 'string' ? JSON.parse(assets) : []

      if (!Array.isArray(parsed)) {
        return []
      }

      return parsed.filter(
        (a: any): a is FullJourneyAsset => a && typeof a === 'object' && a.asset != null && a.amount != null,
      )
    } catch {
      return []
    }
  }

  async #filterJourneyIds(limit: number, filters?: JourneyFilters, cursor?: string) {
    let query = this.#db.selectFrom('xc_journeys').select(['id', 'sent_at'])

    query = this.#applyJourneyFilters(query, filters, cursor)

    return query.orderBy('sent_at', 'desc').limit(limit).execute()
  }

  async #filterJourneyIdsWithAssets(limit: number, filters?: JourneyFilters, cursor?: string) {
    let query = this.#db
      .selectFrom('xc_asset_ops')
      .innerJoin('xc_journeys', 'xc_journeys.id', 'xc_asset_ops.journey_id')
      .select((eb) => [
        eb.ref('xc_asset_ops.journey_id').as('id'),
        eb.fn.max('xc_journeys.sent_at').as('sent_at'),
      ])

    // ASSET filters
    if (filters?.assets) {
      query = query.where('xc_asset_ops.asset', 'in', filters.assets)
    }
    if (filters?.usdAmountGte !== undefined) {
      query = query.where('xc_asset_ops.usd', '>=', filters.usdAmountGte)
    }
    if (filters?.usdAmountLte !== undefined) {
      query = query.where('xc_asset_ops.usd', '<=', filters.usdAmountLte)
    }

    // JOURNEY filters
    query = this.#applyJourneyFilters(query, filters, cursor)

    return query.groupBy('xc_asset_ops.journey_id').orderBy('sent_at', 'desc').limit(limit).execute()
  }

  #applyJourneyFilters<T extends SelectQueryBuilder<any, any, any>>(
    query: T,
    filters?: JourneyFilters,
    cursor?: string,
    prefix = '',
  ): T {
    if (filters === undefined && cursor === undefined) {
      return query
    }

    let extendedQuery = query

    const field = (col: string) => (prefix ? `${prefix}.${col}` : col)

    if (filters?.txHash) {
      extendedQuery = extendedQuery.where((eb) =>
        eb.or([
          eb(field('origin_extrinsic_hash'), '=', filters.txHash!),
          eb(field('origin_evm_tx_hash'), '=', filters.txHash!),
        ]),
      ) as T
    }

    if (filters?.address) {
      const addressPrefix = filters.address.length >= 42 ? filters.address.slice(0, 42) : filters.address
      const paraId = 'urn:ocn:polkadot:2034'

      extendedQuery = extendedQuery.where((eb) =>
        eb.or([
          eb.and([eb(field('origin'), '=', paraId), eb(field('from'), 'like', `${addressPrefix}%`)]),
          eb.and([eb(field('destination'), '=', paraId), eb(field('to'), 'like', `${addressPrefix}%`)]),
          eb.and([eb(field('origin'), '!=', paraId), eb(field('from'), '=', filters.address!)]),
          eb.and([eb(field('destination'), '!=', paraId), eb(field('to'), '=', filters.address!)]),
        ]),
      ) as T
    }

    if (filters?.sentAtGte) {
      extendedQuery = extendedQuery.where(field('sent_at'), '>=', filters.sentAtGte) as T
    }

    if (filters?.sentAtLte) {
      extendedQuery = extendedQuery.where(field('sent_at'), '<=', filters.sentAtLte) as T
    }

    if (filters?.origins) {
      extendedQuery = extendedQuery.where(field('origin'), 'in', filters.origins) as T
    }

    if (filters?.destinations) {
      extendedQuery = extendedQuery.where(field('destination'), 'in', filters.destinations) as T
    }

    if (filters?.networks) {
      extendedQuery = extendedQuery.where((eb) =>
        eb.or([
          eb(field('origin'), 'in', filters.networks!),
          eb(field('destination'), 'in', filters.networks!),
        ]),
      ) as T
    }

    if (filters?.actions) {
      extendedQuery = extendedQuery.where(field('type'), 'in', filters.actions) as T
    }

    if (filters?.status) {
      extendedQuery = extendedQuery.where(field('status'), 'in', filters.status) as T
    }

    if (cursor) {
      const afterDate = decodeCursor(cursor)
      extendedQuery = extendedQuery.where(field('sent_at'), '<', afterDate) as T
    }

    return extendedQuery
  }

  async #getFullJourneyData(journeyIds: number[]) {
    const assetSubquery = this.#db
      .selectFrom('xc_asset_ops')
      .select(['journey_id', sql`SUM(usd)`.as('total_usd')])
      .where('role', '=', 'transfer')
      .groupBy('journey_id')
      .as('asset_totals')

    const query = this.#db
      .selectFrom('xc_journeys')
      .leftJoin(assetSubquery, 'xc_journeys.id', 'asset_totals.journey_id') // changed to LEFT JOIN
      .leftJoin('xc_asset_ops', 'xc_journeys.id', 'xc_asset_ops.journey_id')
      .select([
        'xc_journeys.id',
        'correlation_id',
        'status',
        'type',
        'origin',
        'destination',
        'from',
        'to',
        'from_formatted',
        'to_formatted',
        'sent_at',
        'recv_at',
        'created_at',
        'stops',
        'instructions',
        'transact_calls',
        'origin_extrinsic_hash',
        'origin_evm_tx_hash',
        sql`IFNULL(asset_totals.total_usd, 0)`.as('total_usd'),
        sql`IFNULL(json_group_array(
        CASE
          WHEN xc_asset_ops.asset IS NOT NULL THEN
            json_object(
              'asset', xc_asset_ops.asset,
              'symbol', xc_asset_ops.symbol,
              'amount', xc_asset_ops.amount,
              'decimals', xc_asset_ops.decimals,
              'usd', xc_asset_ops.usd,
              'role', xc_asset_ops.role,
              'sequence', xc_asset_ops.sequence
            )
          ELSE NULL
        END
      ), json('[]'))`.as('assets'),
      ])
      .where('xc_journeys.id', 'in', journeyIds)
      .groupBy('xc_journeys.id')
      .orderBy('xc_journeys.sent_at', 'desc')

    return query.execute()
  }
}
