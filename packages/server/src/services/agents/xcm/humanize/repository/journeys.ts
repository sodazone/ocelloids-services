import { Kysely } from 'kysely'
import {
  FullXcmJourney,
  NewXcmAsset,
  NewXcmJourney,
  XcmAsset,
  XcmDatabase,
  XcmJourney,
  XcmJourneyUpdate,
} from './types.js'

export class XcmRepository {
  readonly #db: Kysely<XcmDatabase>

  constructor(db: Kysely<XcmDatabase>) {
    this.#db = db
  }

  async insertJourney(journey: NewXcmJourney): Promise<void> {
    await this.#db.insertInto('xcm_journeys').values(journey).execute()
  }

  async updateJourney(id: number, updateWith: XcmJourneyUpdate): Promise<void> {
    await this.#db.updateTable('xcm_journeys').set(updateWith).where('id', '=', id).execute()
  }

  async insertAssetsForJourney(assets: Array<NewXcmAsset>): Promise<void> {
    await this.#db.insertInto('xcm_assets').values(assets).execute()
  }

  async listJourneys(limit: number = 50, afterCreatedAt?: Date): Promise<XcmJourney[]> {
    const query = this.#db.selectFrom('xcm_journeys').selectAll().orderBy('created_at', 'desc').limit(limit)

    if (afterCreatedAt) {
      query.where('created_at', '<', afterCreatedAt)
    }

    return await query.execute()
  }

  async getJourneyById(id: number): Promise<XcmJourney | undefined> {
    return await this.#db.selectFrom('xcm_journeys').selectAll().where('id', '=', id).executeTakeFirst()
  }

  async getAssetsForJourney(journeyId: number): Promise<XcmAsset[]> {
    return await this.#db.selectFrom('xcm_assets').selectAll().where('journey_id', '=', journeyId).execute()
  }

  async deleteJourney(id: number): Promise<void> {
    await this.#db.deleteFrom('xcm_journeys').where('id', '=', id).execute()
  }

  async deleteAssetsForJourney(journeyId: number): Promise<void> {
    await this.#db.deleteFrom('xcm_assets').where('journey_id', '=', journeyId).execute()
  }

  async listFullJourneys(limit: number = 50, afterCreatedAt?: Date): Promise<Array<FullXcmJourney>> {
    const query = this.#db
      .selectFrom('xcm_journeys')
      .selectAll('xcm_journeys')
      .innerJoin('xcm_assets', 'xcm_journeys.id', 'xcm_assets.journey_id')
      .selectAll('xcm_assets')
      .orderBy('xcm_journeys.created_at', 'desc')
      .limit(limit)

    if (afterCreatedAt) {
      query.where('xcm_journeys.created_at', '<', afterCreatedAt)
    }

    const rows = await query.execute()

    // Group assets by journey
    const groupedJourneys = rows.reduce(
      (acc, row) => {
        const journeyId = row.id
        if (!acc[journeyId]) {
          acc[journeyId] = { ...row, assets: [] }
        }
        acc[journeyId].assets.push({
          asset: row.asset,
          symbol: row.symbol,
          amount: row.amount,
          decimals: row.decimals,
        })
        return acc
      },
      {} as Record<string, FullXcmJourney>,
    )

    return Object.values(groupedJourneys)
  }
}
