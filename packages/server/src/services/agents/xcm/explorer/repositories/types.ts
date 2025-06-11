import { DeepCamelize } from '@/common/util.js'
import { ColumnType, Generated, Insertable, JSONColumnType, Selectable, Updateable } from 'kysely'
import { HumanizedTransactCall } from '../../humanize/types.js'

export interface XcmJourneyTable {
  id: Generated<number>
  correlation_id: ColumnType<string>
  status: ColumnType<string>
  type: ColumnType<string>
  origin: ColumnType<string>
  destination: ColumnType<string>
  from: ColumnType<string>
  to: ColumnType<string>
  from_formatted: ColumnType<string | undefined>
  to_formatted: ColumnType<string | undefined>
  sent_at: ColumnType<number, number | undefined, never>
  recv_at: ColumnType<number, number | undefined, number | undefined>
  created_at: ColumnType<number, number, never>
  stops: JSONColumnType<any>
  instructions: JSONColumnType<any>
  transact_calls: JSONColumnType<HumanizedTransactCall[]>
  origin_extrinsic_hash: ColumnType<string | undefined>
  origin_evm_tx_hash: ColumnType<string | undefined>
}

export type XcmJourney = Selectable<XcmJourneyTable>
export type NewXcmJourney = Insertable<XcmJourneyTable>
export type XcmJourneyUpdate = Updateable<XcmJourneyTable>

export interface XcmAssetTable {
  id: Generated<number>
  journey_id: ColumnType<number>
  asset: ColumnType<string>
  symbol: ColumnType<string | undefined>
  amount: ColumnType<string>
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

export type XcmJourneyClient = DeepCamelize<XcmJourney>
export type XcmAssetClient = DeepCamelize<XcmAsset>

export type FullXcmJourneyClient = DeepCamelize<FullXcmJourney>
