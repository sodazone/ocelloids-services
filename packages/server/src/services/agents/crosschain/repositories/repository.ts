import { Twox256 } from '@polkadot-api/substrate-bindings'
import { DeleteResult, Kysely, SelectQueryBuilder, sql, Transaction } from 'kysely'
import { toHex } from 'polkadot-api/utils'
import { ulid } from 'ulidx'
import { asJSON, stringToUa8 } from '@/common/util.js'
import { QueryPagination } from '@/lib.js'
import { JourneyFilters } from '../types/queries.js'
import {
  AssetOperation,
  AssetOperationUpdate,
  AssetRole,
  CrosschainDatabase,
  FullJourney,
  FullJourneyAsset,
  Journey,
  JourneyStatus,
  JourneyUpdate,
  ListAsset,
  NewAssetOperation,
  NewJourney,
} from './types.js'

const MAX_LIMIT = 100

function encodeCursor(journeys: FullJourney[]): string {
  for (let i = journeys.length - 1; i >= 0; i--) {
    const journey = journeys[i]
    const { sent_at, id } = journey

    if (sent_at !== undefined && sent_at !== null) {
      const timestamp = typeof sent_at === 'number' ? sent_at : (sent_at as Date).getTime()

      return Buffer.from(`${timestamp}|${id}`).toString('base64')
    }
  }

  throw new Error('No sent_at timestamp found in journeys list')
}

function decodeCursor(cursor: string): { timestamp: number; id: number } {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
    const [timestampStr, idStr] = decoded.split('|')
    const timestamp = parseInt(timestampStr, 10)
    const id = parseInt(idStr, 10)
    if (isNaN(timestamp) || isNaN(id)) {
      throw new Error()
    }
    return { timestamp, id }
  } catch {
    throw new Error('Invalid cursor format')
  }
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

function parseAssets(assets: any): FullJourneyAsset[] {
  try {
    const parsed = Array.isArray(assets) ? assets : typeof assets === 'string' ? JSON.parse(assets) : []

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter(
        (a: any): a is FullJourneyAsset => a && typeof a === 'object' && a.asset != null && a.amount != null,
      )
      .map((a) => ({
        ...a,
        amount: String(a.amount),
      }))
  } catch {
    return []
  }
}

function mapRowToFullJourney(row: any): FullJourney {
  return {
    id: row.id,
    correlation_id: row.correlation_id,
    trip_id: row.trip_id,
    status: row.status,
    type: row.type,
    origin_protocol: row.origin_protocol,
    destination_protocol: row.destination_protocol,
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
    origin_tx_primary: row.origin_tx_primary,
    origin_tx_secondary: row.origin_tx_secondary,
    destination_tx_primary: row.destination_tx_primary,
    destination_tx_secondary: row.destination_tx_secondary,
    in_connection_fk: row.in_connection_fk,
    in_connection_data: row.in_connection_data,
    out_connection_fk: row.out_connection_fk,
    out_connection_data: row.out_connection_data,
    totalUsd: Number(row.total_usd ?? 0),
    assets: parseAssets(row.assets),
  }
}

function mergeStops(inStops: any[] = [], outStops: any[] = []): string {
  const map = new Map<string, any>()

  const makeKey = (s: any) => `${s.type}:${s.from?.chainId ?? ''}:${s.to?.chainId ?? ''}`

  for (const stop of [...inStops, ...outStops]) {
    const key = makeKey(stop)
    if (!map.has(key)) {
      map.set(key, stop)
    }
  }

  return asJSON(Array.from(map.values()))
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
  ): Promise<Pick<AssetOperation, 'asset' | 'role' | 'sequence' | 'amount'>[]> {
    return this.#db
      .selectFrom('xc_asset_ops')
      .select(['asset', 'role', 'sequence', 'amount'])
      .where('journey_id', '=', journeyId)
      .execute()
  }

  async addAssetToJourney(journeyId: number, assets: Omit<NewAssetOperation, 'journey_id'>[]) {
    const existingAssets = await this.getAssetIdentifiers(journeyId)
    const existingKeySet = new Set(existingAssets.map((a) => `${a.asset}-${a.role ?? ''}-${a.amount}`))
    const newAssets = assets
      .filter((asset) => {
        const key = `${asset.asset}-${asset.role ?? ''}-${asset.amount}`
        return !existingKeySet.has(key)
      })
      .map((a, i) => ({
        ...a,
        sequence: existingAssets.length + i,
      }))

    if (newAssets.length > 0) {
      await this.insertAssetsForJourney(journeyId, newAssets)
    }
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

  async deleteJourney(id: number): Promise<DeleteResult[]> {
    return await this.#db.deleteFrom('xc_journeys').where('id', '=', id).execute()
  }

  async deleteJourneysByProtocol(protocol: string): Promise<DeleteResult[]> {
    return await this.#db
      .deleteFrom('xc_journeys')
      .where((eb) => eb('origin_protocol', '=', protocol).or('destination_protocol', '=', protocol))
      .execute()
  }

  async addJourneys(
    journeys: Array<{ journey: NewJourney; assets: Omit<NewAssetOperation, 'journey_id'>[] }>,
  ): Promise<number[]> {
    return this.#db.transaction().execute(async (trx) => {
      const ids: number[] = []
      for (const { journey, assets } of journeys) {
        ids.push(await this.insertJourneyWithAssets(journey, assets, trx))
      }
      return ids
    })
  }

  async insertJourneyWithAssets(
    journey: NewJourney,
    assets: Array<Omit<NewAssetOperation, 'journey_id'>>,
    db: Kysely<CrosschainDatabase> | Transaction<CrosschainDatabase> = this.#db,
  ): Promise<number> {
    const insertedJourney = await db
      .insertInto('xc_journeys')
      .values(journey)
      .returning('id')
      .executeTakeFirst()

    if (!insertedJourney?.id) {
      throw new Error('Failed to insert journey')
    }

    const journeyId = insertedJourney.id
    await this.insertAssetsForJourney(journeyId, assets, db)
    return journeyId
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

    if (results.length > 0) {
      // Upsert into snapshot table
      await this.#db
        .insertInto('xc_asset_volume_cache')
        .values(
          results.map((row) => ({
            ...row,
            usd_volume: Number(row.usd_volume),
            snapshot_end,
            snapshot_start,
          })),
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
  }

  async getJourneyById(id: number): Promise<FullJourney | undefined> {
    const rows = await this.#getFullJourneyData([id])
    return rows.length > 0 ? mapRowToFullJourney(rows[0]) : undefined
  }

  async getJourneyByCorrelationId(correlationId: string): Promise<FullJourney | undefined> {
    const rows = await this.#getFullJourneyData([correlationId], 'correlation_id')
    return rows.length > 0 ? mapRowToFullJourney(rows[0]) : undefined
  }

  async getJourneyByTripId(tripId?: string): Promise<Journey | undefined> {
    if (tripId === undefined) {
      return undefined
    }

    return await this.#db
      .selectFrom('xc_journeys')
      .selectAll()
      .where('trip_id', '=', tripId)
      .executeTakeFirst()
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
      const latestSnapshot = await this.getLatestSnapshot()

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

  async getLatestSnapshot() {
    return await this.#db
      .selectFrom('xc_asset_volume_cache')
      .select(['snapshot_start', 'snapshot_end'])
      .orderBy('snapshot_end', 'desc')
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

    // Determine whether we need to pre-filter assets
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

    const nodes = rows.map(mapRowToFullJourney)

    const endCursor = nodes.length > 0 ? encodeCursor(nodes) : ''

    return {
      nodes,
      pageInfo: {
        hasNextPage,
        endCursor,
      },
    }
  }

  /**
   * Generate a new trip_id (ULID)
   */
  generateTripId(identifiers?: { chainId: string; values: string[] }): string {
    if (identifiers) {
      return toHex(Twox256(stringToUa8(`${identifiers.chainId}${identifiers.values.join()}`)))
    }

    return ulid()
  }

  /**
   * Assign a journey to a trip_id (creates a new one if not provided)
   */
  async assignJourneyToTrip(journeyId: number, tripId?: string): Promise<string> {
    const finalTripId = tripId ?? this.generateTripId()

    await this.#db
      .updateTable('xc_journeys')
      .set({ trip_id: finalTripId })
      .where('id', '=', journeyId)
      .execute()

    return finalTripId
  }

  async mergeJourneys(inJourneyId: number, outJourneyId: number, tripId?: string): Promise<number> {
    return await this.#db.transaction().execute(async (trx) => {
      const inJourney = await trx
        .selectFrom('xc_journeys')
        .selectAll()
        .where('id', '=', inJourneyId)
        .executeTakeFirst()

      if (!inJourney) {
        throw new Error(`Inbound journey ${inJourneyId} not found`)
      }

      const outJourney = await trx
        .selectFrom('xc_journeys')
        .selectAll()
        .where('id', '=', outJourneyId)
        .executeTakeFirst()

      if (!outJourney) {
        throw new Error(`Outbound journey ${outJourneyId} not found`)
      }

      // --- Merge stops ---
      const mergedStops = mergeStops((inJourney.stops ?? []) as any[], (outJourney.stops ?? []) as any[])

      // --- Build update payload ---
      const update: JourneyUpdate = {
        trip_id: tripId ?? inJourney.trip_id ?? outJourney.trip_id,

        destination_protocol: outJourney.destination_protocol,
        destination: outJourney.destination,
        to: outJourney.to,
        to_formatted: outJourney.to_formatted,
        recv_at: outJourney.recv_at,
        status: outJourney.status,
        type: outJourney.type,

        destination_tx_primary: outJourney.destination_tx_primary,
        destination_tx_secondary: outJourney.destination_tx_secondary,

        // merged data
        stops: mergedStops,
      }

      // --- Update inbound journey ---
      await trx.updateTable('xc_journeys').set(update).where('id', '=', inJourneyId).execute()

      // --- Delete outbound journey ---
      await trx.deleteFrom('xc_journeys').where('id', '=', outJourneyId).execute()

      return inJourney.id
    })
  }

  /**
   * Connect two journeys (A → B) as consecutive hops in the same trip.
   */
  async connectJourneys(
    inJourneyId: number,
    outJourneyId: number,
    connectionData?: Record<string, any>,
  ): Promise<string> {
    // Ensure they share the same trip_id
    const inJourney = await this.#db
      .selectFrom('xc_journeys')
      .select(['trip_id'])
      .where('id', '=', inJourneyId)
      .executeTakeFirst()

    let tripId = inJourney?.trip_id

    if (!tripId) {
      tripId = this.generateTripId()
      await this.assignJourneyToTrip(inJourneyId, tripId)
    }

    await this.assignJourneyToTrip(outJourneyId, tripId)

    // update connection references
    await this.#db
      .updateTable('xc_journeys')
      .set({
        out_connection_fk: outJourneyId,
        out_connection_data: connectionData ? JSON.stringify(connectionData) : undefined,
      })
      .where('id', '=', inJourneyId)
      .execute()

    await this.#db
      .updateTable('xc_journeys')
      .set({
        in_connection_fk: inJourneyId,
        in_connection_data: connectionData ? JSON.stringify(connectionData) : undefined,
      })
      .where('id', '=', outJourneyId)
      .execute()

    return tripId
  }

  async getJourneysByStatus(
    status: JourneyStatus | JourneyStatus[],
    protocols?: string | string[],
  ): Promise<FullJourney[]> {
    const statuses = Array.isArray(status) ? status : [status]
    const protocolList = protocols ? (Array.isArray(protocols) ? protocols : [protocols]) : undefined

    let query = this.#db.selectFrom('xc_journeys').select('id').where('status', 'in', statuses)

    if (protocolList && protocolList.length > 0) {
      query = query.where((eb) =>
        eb.or([eb('origin_protocol', 'in', protocolList), eb('destination_protocol', 'in', protocolList)]),
      )
    }

    query = query.orderBy('sent_at', 'desc')

    const ids = await query.execute()

    if (ids.length === 0) {
      return []
    }

    const rows = await this.#getFullJourneyData(ids.map((r) => r.id))
    return rows.map(mapRowToFullJourney)
  }

  /**
   * Get all journeys belonging to a trip
   */
  async getTripJourneys(tripId: string): Promise<FullJourney[]> {
    const ids = await this.#db
      .selectFrom('xc_journeys')
      .select('id')
      .where('trip_id', '=', tripId)
      .orderBy('sent_at', 'asc')
      .orderBy('id', 'asc')
      .execute()

    if (ids.length === 0) {
      return []
    }

    const rows = await this.#getFullJourneyData(
      ids.map((r) => r.id),
      'id',
      'asc',
    )
    return rows.map(mapRowToFullJourney)
  }

  async #filterJourneyIds(limit: number, filters?: JourneyFilters, cursor?: string) {
    let query = this.#db.selectFrom('xc_journeys').select(['id', 'sent_at'])

    query = this.#applyJourneyFilters(query, filters, cursor)

    return query.orderBy('sent_at', 'desc').orderBy('id', 'desc').limit(limit).execute()
  }

  async #filterJourneyIdsWithAssets(limit: number, filters?: JourneyFilters, cursor?: string) {
    const usdGte = filters?.usdAmountGte
    const usdLte = filters?.usdAmountLte

    // aggregate USD per journey
    let assetAggQuery = this.#db
      .selectFrom('xc_asset_ops')
      .select((eb) => [eb.ref('journey_id').as('journey_id'), eb.fn.sum('usd').as('total_usd')])
      .groupBy('journey_id')

    if (usdGte !== undefined) {
      assetAggQuery = assetAggQuery.having((eb) => eb.fn.sum('usd'), '>=', usdGte)
    }
    if (usdLte !== undefined) {
      assetAggQuery = assetAggQuery.having((eb) => eb.fn.sum('usd'), '<=', usdLte)
    }

    if (filters?.assets) {
      assetAggQuery = assetAggQuery.where('asset', 'in', filters.assets)
    }

    const assetSubquery = assetAggQuery.as('agg_assets')

    // aggregated USD back to journeys
    let query = this.#db
      .selectFrom('xc_journeys')
      .innerJoin(assetSubquery, 'xc_journeys.id', 'agg_assets.journey_id')
      .select(['xc_journeys.id', 'xc_journeys.sent_at'])

    // apply other journey filters
    query = this.#applyJourneyFilters(query, filters, cursor)

    return query.orderBy('sent_at', 'desc').orderBy('id', 'desc').limit(limit).execute()
  }

  #applyJourneyFilters<T extends SelectQueryBuilder<any, any, any>>(
    query: T,
    filters?: JourneyFilters,
    cursor?: string,
    prefix = '',
  ): T {
    if (!filters && !cursor) {
      return query
    }

    const field = (col: string) => (prefix ? `${prefix}.${col}` : col)

    let baseQuery = query

    // txHash filter
    if (filters?.txHash) {
      baseQuery = baseQuery.where((eb) =>
        eb.or([
          eb(field('origin_tx_primary'), '=', filters.txHash),
          eb(field('origin_tx_secondary'), '=', filters.txHash),
        ]),
      ) as T
    }

    // address filter
    if (filters?.address) {
      if (filters.address.length > 42) {
        const addressPrefix = filters.address.slice(0, 42).toLowerCase()
        baseQuery = baseQuery.where((eb) =>
          eb.or([
            eb(field('from'), 'like', `${addressPrefix}%`),
            eb(field('to'), 'like', `${addressPrefix}%`),
          ]),
        ) as T
      } else {
        baseQuery = baseQuery.where((eb) =>
          eb.or([
            eb(field('from'), '=', filters.address!.toLowerCase()),
            eb(field('to'), '=', filters.address!.toLowerCase()),
          ]),
        ) as T
      }
    }

    // sentAt filters
    if (filters?.sentAtGte) {
      baseQuery = baseQuery.where(field('sent_at'), '>=', filters.sentAtGte) as T
    }
    if (filters?.sentAtLte) {
      baseQuery = baseQuery.where(field('sent_at'), '<=', filters.sentAtLte) as T
    }

    // origin/destination filters
    if (filters?.origins) {
      baseQuery = baseQuery.where(field('origin'), 'in', filters.origins) as T
    }
    if (filters?.destinations) {
      baseQuery = baseQuery.where(field('destination'), 'in', filters.destinations) as T
    }

    // actions/status
    if (filters?.actions) {
      baseQuery = baseQuery.where(field('type'), 'in', filters.actions) as T
    }
    if (filters?.status) {
      baseQuery = baseQuery.where(field('status'), 'in', filters.status) as T
    }

    // cursor
    if (cursor) {
      const { timestamp, id } = decodeCursor(cursor)
      baseQuery = baseQuery.where((eb) =>
        eb.or([
          eb('sent_at', '<', timestamp),
          eb.and([eb('sent_at', '=', timestamp), eb('xc_journeys.id', '<', id)]),
        ]),
      ) as T
    }

    if (filters?.protocols) {
      const protoBranches: any[] = []

      const protoOriginBase = baseQuery.where(field('origin_protocol'), 'in', filters.protocols)
      const protoDestBase = baseQuery.where(field('destination_protocol'), 'in', filters.protocols)

      if (filters?.networks) {
        for (const protoBase of [protoOriginBase, protoDestBase]) {
          const netOriginBranch = protoBase.where(field('origin'), 'in', filters.networks)
          const netDestBranch = protoBase.where(field('destination'), 'in', filters.networks)

          protoBranches.push(netOriginBranch, netDestBranch)
        }
      } else {
        protoBranches.push(protoOriginBase, protoDestBase)
      }

      let combined = protoBranches[0]
      for (const branch of protoBranches.slice(1)) {
        combined = combined.unionAll(branch)
      }

      return this.#db.selectFrom(combined.as('combined_proto')).selectAll().groupBy('id') as T
    }

    if (filters?.networks) {
      const networkBase = baseQuery

      const originBranch = networkBase.where(field('origin'), 'in', filters.networks)
      const destinationBranch = networkBase.where(field('destination'), 'in', filters.networks)

      return this.#db
        .selectFrom(originBranch.unionAll(destinationBranch).as('combined_network'))
        .selectAll()
        .groupBy('id') as T
    }

    return baseQuery
  }

  async #getFullJourneyData(
    values: (number | string)[],
    field: 'id' | 'correlation_id' = 'id',
    order: 'asc' | 'desc' = 'desc',
  ) {
    const query = this.#db
      .selectFrom('xc_journeys')
      .leftJoin(
        this.#db
          .selectFrom('xc_asset_ops')
          .select(['journey_id', sql`SUM(usd)`.as('total_usd')])
          .where('role', '=', 'transfer')
          .groupBy('journey_id')
          .as('asset_totals'),
        'xc_journeys.id',
        'asset_totals.journey_id',
      )
      .leftJoin('xc_asset_ops', 'xc_journeys.id', 'xc_asset_ops.journey_id')
      .select([
        'xc_journeys.id',
        'correlation_id',
        'trip_id',
        'status',
        'type',
        'origin_protocol',
        'destination_protocol',
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
        'origin_tx_primary',
        'origin_tx_secondary',
        'in_connection_fk',
        'in_connection_data',
        'out_connection_fk',
        'out_connection_data',
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
      .where(`xc_journeys.${field}`, 'in', values)
      .groupBy('xc_journeys.id')
      .orderBy('xc_journeys.sent_at', order)

    return query.execute()
  }
}
