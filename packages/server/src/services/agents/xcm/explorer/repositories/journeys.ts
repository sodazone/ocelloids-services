import { Buffer } from 'buffer'
import { QueryPagination } from '@/lib.js'
import { Kysely, sql } from 'kysely'
import { JourneyFilters } from '../../types/index.js'
import { FullXcmJourney, NewXcmAsset, NewXcmJourney, XcmDatabase, XcmJourneyUpdate } from './types.js'

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

  async getJourneyById(id: number): Promise<FullXcmJourney | undefined> {
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
      .where('xcm_journeys.id', '=', id)
      .execute()

    if (rows.length === 0) {
      return undefined
    }

    const journey = {
      id: rows[0].id,
      correlation_id: rows[0].correlation_id,
      status: rows[0].status,
      type: rows[0].type,
      origin: rows[0].origin,
      destination: rows[0].destination,
      from: rows[0].from,
      to: rows[0].to,
      sent_at: rows[0].sent_at,
      recv_at: rows[0].recv_at,
      created_at: rows[0].created_at,
      stops: rows[0].stops,
      instructions: rows[0].instructions,
      origin_extrinsic_hash: rows[0].origin_extrinsic_hash ?? undefined,
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

    let query = this.#db
      .selectFrom('xcm_journeys')
      .select([
        'xcm_journeys.id',
        'xcm_journeys.correlation_id',
        'xcm_journeys.status',
        'xcm_journeys.type',
        'xcm_journeys.origin',
        'xcm_journeys.destination',
        'xcm_journeys.from',
        'xcm_journeys.to',
        'xcm_journeys.sent_at',
        'xcm_journeys.recv_at',
        'xcm_journeys.created_at',
        'xcm_journeys.stops',
        'xcm_journeys.instructions',
        'xcm_journeys.origin_extrinsic_hash',
        sql`json_group_array(json_object(
        'asset', xcm_assets.asset,
        'symbol', xcm_assets.symbol,
        'amount', xcm_assets.amount,
        'decimals', xcm_assets.decimals,
        'usd', xcm_assets.usd
      ))`.as('assets'),
      ])
      .leftJoin('xcm_assets', 'xcm_journeys.id', 'xcm_assets.journey_id')
      .groupBy('xcm_journeys.id')
      .orderBy('xcm_journeys.sent_at', 'desc')
      .limit(realLimit)

    if (pagination?.cursor) {
      const afterDate = decodeCursor(pagination.cursor)
      query = query.where('xcm_journeys.sent_at', '<', afterDate)
    }

    if (filters?.asset) {
      query = query.where('xcm_assets.asset', 'in', filters.asset)
    }

    if (filters?.origin) {
      query = query.where('xcm_journeys.origin', 'in', filters.origin)
    }

    const rows = await query.execute()

    const hasNextPage = rows.length > limit
    const limitedRows = hasNextPage ? rows.slice(0, limit) : rows

    const nodes = limitedRows.map((row) => ({
      id: row.id,
      correlation_id: row.correlation_id,
      status: row.status,
      type: row.type,
      origin: row.origin,
      destination: row.destination,
      from: row.from,
      to: row.to,
      sent_at: row.sent_at,
      recv_at: row.recv_at,
      created_at: row.created_at,
      stops: row.stops,
      instructions: row.instructions,
      origin_extrinsic_hash: row.origin_extrinsic_hash,
      assets: Array.isArray(row.assets) ? row.assets : [],
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

      const assetsWithJourneyId = assets.map((asset) => ({
        ...asset,
        journey_id: journeyId,
      }))
      await trx.insertInto('xcm_assets').values(assetsWithJourneyId).execute()

      return journeyId
    })
  }

  async getJourneyByCorrelationId(correlationId: string): Promise<FullXcmJourney | undefined> {
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
      .where('xcm_journeys.correlation_id', '=', correlationId)
      .execute()

    if (rows.length === 0) {
      return undefined
    }

    const journey = {
      id: rows[0].id,
      correlation_id: rows[0].correlation_id,
      status: rows[0].status,
      type: rows[0].type,
      origin: rows[0].origin,
      destination: rows[0].destination,
      from: rows[0].from,
      to: rows[0].to,
      sent_at: rows[0].sent_at,
      recv_at: rows[0].recv_at,
      created_at: rows[0].created_at,
      stops: rows[0].stops,
      instructions: rows[0].instructions,
      origin_extrinsic_hash: rows[0].origin_extrinsic_hash ?? undefined,
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

  async close() {
    await this.#db.destroy()
  }
}
