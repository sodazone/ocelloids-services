import { ColumnType, Generated, Insertable, JSONColumnType, Selectable, Updateable } from 'kysely'

export interface XcmJourneyTable {
  id: Generated<number>
  correlation_id: ColumnType<string>
  status: ColumnType<string>
  type: ColumnType<string>
  origin: ColumnType<string>
  destination: ColumnType<string>
  from: ColumnType<string>
  to: ColumnType<string>
  sent_at: ColumnType<Date, number | undefined, never>
  recv_at: ColumnType<Date, number | undefined, number | undefined>
  created_at: ColumnType<Date, number, never>
  stops: JSONColumnType<any>
  instructions: JSONColumnType<any>
  origin_extrinsic_hash: ColumnType<string | undefined>
}

export type XcmJourney = Selectable<XcmJourneyTable>
export type NewXcmJourney = Insertable<XcmJourneyTable>
export type XcmJourneyUpdate = Updateable<XcmJourneyTable>

export interface XcmAssetTable {
  id: Generated<number>
  journey_id: ColumnType<number>
  asset: ColumnType<string>
  symbol: ColumnType<string | undefined>
  amount: ColumnType<bigint>
  decimals: ColumnType<number | undefined>
  usd: ColumnType<number | undefined>
}

export type XcmAsset = Selectable<XcmAssetTable>
export type NewXcmAsset = Insertable<XcmAssetTable>
export type XcmAssetUpdate = Updateable<XcmAssetTable>

export interface XcmDatabase {
  xcm_journeys: XcmJourneyTable
  xcm_assets: XcmAssetTable
}

export type FullXcmJourney = XcmJourney & {
  assets: Omit<XcmAsset, 'id' | 'journey_id'>[]
}
