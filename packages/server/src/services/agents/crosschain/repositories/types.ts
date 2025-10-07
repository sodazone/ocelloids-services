import { DeepCamelize } from '@/common/util.js'
import { ColumnType, Generated, Insertable, JSONColumnType, Selectable, Updateable } from 'kysely'

/**
 * Cross chain asset role.
 *
 * @public
 */
export type AssetRole =
  | 'transfer'
  | 'swap_in'
  | 'swap_out'
  | 'fee'
  | 'trapped'
  | 'refunded'
  | 'intermediate'
  | null

/**
 * @public
 */
export interface XcJourneyTable {
  id: Generated<number>
  correlation_id: ColumnType<string>
  trip_id: ColumnType<string | undefined>
  status: ColumnType<string>
  type: ColumnType<string>
  origin_protocol: ColumnType<string>
  destination_protocol: ColumnType<string>
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
  transact_calls: JSONColumnType<any[]>
  origin_tx_primary: ColumnType<string | undefined>
  origin_tx_secondary: ColumnType<string | undefined>
  destination_tx_primary: ColumnType<string | undefined>
  destination_tx_secondary: ColumnType<string | undefined>
  in_connection_fk: ColumnType<number | undefined>
  in_connection_data?: JSONColumnType<any>
  out_connection_fk: ColumnType<number | undefined>
  out_connection_data?: JSONColumnType<any>
}

/**
 * @public
 */
export type Journey = Selectable<XcJourneyTable>
export type NewJourney = Insertable<XcJourneyTable>
export type JourneyUpdate = Updateable<XcJourneyTable>

/**
 * @public
 */
export interface XcAssetOperationTable {
  id: Generated<number>
  journey_id: ColumnType<number>
  asset: ColumnType<string>
  symbol: ColumnType<string | undefined>
  amount: ColumnType<string>
  decimals: ColumnType<number | undefined>
  usd: ColumnType<number | undefined>
  role: ColumnType<AssetRole | undefined>
  sequence: ColumnType<number | undefined>
}

/**
 * @public
 */
export type AssetOperation = Selectable<XcAssetOperationTable>
export type NewAssetOperation = Insertable<XcAssetOperationTable>
export type AssetOperationUpdate = Updateable<XcAssetOperationTable>

export interface CrosschainDatabase {
  xc_journeys: XcJourneyTable
  xc_asset_ops: XcAssetOperationTable
  xc_asset_volume_cache: XcAssetVolumeCache
}

/**
 * @public
 */
export type FullJourneyAsset = Omit<AssetOperation, 'id' | 'journey_id'>

/**
 * @public
 */
export type FullJourney = Journey & {
  totalUsd: number
  assets: FullJourneyAsset[]
}

/**
 * @public
 */
export type JourneyResponse = DeepCamelize<Journey>

/**
 * @public
 */
export type AssetOperationResponse = DeepCamelize<AssetOperation>

/**
 * @public
 */
export type FullJourneyResponse = DeepCamelize<FullJourney>

/**
 * @public
 */
export type ListAsset = {
  asset: string
  symbol?: string | undefined
}

/**
 * @public
 */
export type AssetOperationKey = {
  journeyId: number
  assetId: string
  role?: AssetRole
  sequence?: number
}

export interface XcAssetVolumeCache {
  asset: ColumnType<string>
  symbol: ColumnType<string | undefined>
  usd_volume: ColumnType<number>
  snapshot_start: ColumnType<number>
  snapshot_end: ColumnType<number>
}

export type AssetVolumeCacheRow = Selectable<XcAssetVolumeCache>
export type NewAssetVolumeCache = Insertable<XcAssetVolumeCache>
export type AssetVolumeCacheUpdate = Updateable<XcAssetVolumeCache>
