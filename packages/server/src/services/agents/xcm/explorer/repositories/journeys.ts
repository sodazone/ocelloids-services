import { Buffer } from 'buffer'
import { QueryPagination } from '@/lib.js'
import { Kysely, SelectQueryBuilder, sql } from 'kysely'
import { JourneyFilters } from '../../types/index.js'
import {
  FullXcmJourney,
  FullXcmJourneyAsset,
  NewXcmAsset,
  NewXcmJourney,
  XcmDatabase,
  XcmJourneyUpdate,
} from './types.js'

function encodeCursor(date: number | Date): string {
  const timestamp = typeof date === 'number' ? date : date.getTime() // Convert Date to Unix epoch
  return Buffer.from(timestamp.toString()).toString('base64') // Encode Unix epoch as Base64
}

function decodeCursor(cursor: string): number {
  return parseInt(Buffer.from(cursor, 'base64').toString('utf-8'), 10) // Decode Base64 to Unix epoch
}

export class XcmRepository {
  readonly #db: Kysely<XcmDatabase>

  constructor(db: Kysely<XcmDatabase>) {
    this.#db = db
  }

  async updateJourney(id: number, updateWith: XcmJourneyUpdate): Promise<void> {
    await this.#db.updateTable('xcm_journeys').set(updateWith).where('id', '=', id).execute()
  }

  async getJourneyById(id: string): Promise<FullXcmJourney | undefined> {
    const rows = await this.#db
      .selectFrom('xcm_journeys')
      .selectAll('xcm_journeys')
      .leftJoin('xcm_assets', 'xcm_journeys.id', 'xcm_assets.journey_id')
      .select([
        'xcm_assets.asset',
        'xcm_assets.symbol',
        'xcm_assets.amount',
        'xcm_assets.decimals',
        'xcm_assets.usd',
      ])
      .where('xcm_journeys.correlation_id', '=', id)
      .execute()

    if (rows.length === 0) {
      return undefined
    }

    const totalUsd = rows.reduce((sum, row) => {
      const usd = typeof row.usd === 'number' ? row.usd : Number(row.usd ?? 0)
      return sum + (isNaN(usd) ? 0 : usd)
    }, 0)

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
      assets: rows.map((row) => ({
        asset: row.asset ?? 'unknown',
        symbol: row.symbol ?? undefined,
        amount: row.amount ?? '0',
        decimals: row.decimals ?? undefined,
        usd: row.usd ?? undefined,
      })),
    }

    return journey
  }

  async deleteJourney(id: number): Promise<void> {
    await this.#db.deleteFrom('xcm_journeys').where('id', '=', id).execute()
  }

  async insertJourneyWithAssets(
    journey: NewXcmJourney,
    assets: Array<Omit<NewXcmAsset, 'journey_id'>>,
  ): Promise<number> {
    return await this.#db.transaction().execute(async (trx) => {
      const insertedJourney = await trx
        .insertInto('xcm_journeys')
        .values(journey)
        .returning('id')
        .executeTakeFirst()

      if (!insertedJourney?.id) {
        throw new Error('Failed to insert journey')
      }

      const journeyId = insertedJourney.id

      if (assets.length > 0) {
        const assetsWithJourneyId = assets.map((asset) => ({
          ...asset,
          journey_id: journeyId,
        }))

        await trx.insertInto('xcm_assets').values(assetsWithJourneyId).execute()
      }

      return journeyId
    })
  }

  async close() {
    await this.#db.destroy()
  }

  async listFullJourneys(
    filters?: JourneyFilters,
    pagination?: QueryPagination,
  ): Promise<{
    nodes: Array<FullXcmJourney>
    pageInfo: {
      hasNextPage: boolean
      endCursor: string
    }
  }> {
    const limit = Math.min(pagination?.limit ?? 50, 100)
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

  #parseAssets(assets: any): FullXcmJourneyAsset[] {
    try {
      const parsed = Array.isArray(assets) ? assets : typeof assets === 'string' ? JSON.parse(assets) : []

      if (!Array.isArray(parsed)) {
        return []
      }

      return parsed.filter(
        (a: any): a is FullXcmJourneyAsset =>
          a && typeof a === 'object' && a.asset != null && a.amount != null,
      )
    } catch {
      return []
    }
  }

  async #filterJourneyIds(limit: number, filters?: JourneyFilters, cursor?: string) {
    let query = this.#db.selectFrom('xcm_journeys').select(['id', 'sent_at'])

    query = this.#applyJourneyFilters(query, filters, cursor)

    return query.orderBy('sent_at', 'desc').limit(limit).execute()
  }

  async #filterJourneyIdsWithAssets(limit: number, filters?: JourneyFilters, cursor?: string) {
    let query = this.#db
      .selectFrom('xcm_assets')
      .innerJoin('xcm_journeys', 'xcm_journeys.id', 'xcm_assets.journey_id')
      .select((eb) => [
        eb.ref('xcm_assets.journey_id').as('id'),
        eb.fn.max('xcm_journeys.sent_at').as('sent_at'),
      ])

    // ASSET filters
    if (filters?.assets) {
      query = query.where('xcm_assets.asset', 'in', filters.assets)
    }
    if (filters?.usdAmountGte !== undefined) {
      query = query.where('xcm_assets.usd', '>=', filters.usdAmountGte)
    }
    if (filters?.usdAmountLte !== undefined) {
      query = query.where('xcm_assets.usd', '<=', filters.usdAmountLte)
    }

    // JOURNEY filters
    query = this.#applyJourneyFilters(query, filters, cursor)

    return query.groupBy('xcm_assets.journey_id').orderBy('sent_at', 'desc').limit(limit).execute()
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
      .selectFrom('xcm_assets')
      .select(['journey_id', sql`SUM(usd)`.as('total_usd')])
      .groupBy('journey_id')
      .as('asset_totals')

    const query = this.#db
      .selectFrom('xcm_journeys')
      .leftJoin(assetSubquery, 'xcm_journeys.id', 'asset_totals.journey_id') // changed to LEFT JOIN
      .leftJoin('xcm_assets', 'xcm_journeys.id', 'xcm_assets.journey_id')
      .select([
        'xcm_journeys.id',
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
          WHEN xcm_assets.asset IS NOT NULL THEN
            json_object(
              'asset', xcm_assets.asset,
              'symbol', xcm_assets.symbol,
              'amount', xcm_assets.amount,
              'decimals', xcm_assets.decimals,
              'usd', xcm_assets.usd
            )
          ELSE NULL
        END
      ), json('[]'))`.as('assets'),
      ])
      .where('xcm_journeys.id', 'in', journeyIds)
      .groupBy('xcm_journeys.id')
      .orderBy('xcm_journeys.sent_at', 'desc')

    return query.execute()
  }
}
