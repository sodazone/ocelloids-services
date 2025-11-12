import type { ColumnType, Generated, Insertable, JSONColumnType, Selectable, Updateable } from 'kysely'

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

export type JourneyStatus = 'received' | 'failed' | 'timeout' | 'sent' | 'waiting' | 'unknown'

/**
 * @public
 */
export type JourneyResponse = {
  id: number
  correlationId: string
  tripId?: string
  status: string
  type: string
  originProtocol: string
  destinationProtocol: string
  origin: string
  destination: string
  from: string
  to: string
  fromFormatted?: string
  toFormatted?: string
  sentAt?: number
  recvAt?: number
  createdAt: number
  stops: any
  instructions: any
  transactCalls: any[]
  originTxPrimary?: string
  originTxSecondary?: string
  destinationTxPrimary?: string
  destinationTxSecondary?: string
  inConnectionFk?: number
  inConnectionData?: any
  outConnectionFk?: number
  outConnectionData?: any
}

/**
 * @public
 */
export type AssetOperationResponse = {
  id: number
  journeyId: number
  asset: string
  symbol?: string
  amount: string
  decimals?: number
  usd?: number
  role?: AssetRole
  sequence?: number
}

/**
 * @public
 */
export type FullJourneyResponse = JourneyResponse & {
  totalUsd: number
  assets: Omit<AssetOperationResponse, 'id' | 'journeyId'>[]
}

/**
 * @public
 */
export type ListAsset = {
  asset: string
  symbol?: string
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

/**
 * @internal
 */
export interface XcJourneyTable {
  id: Generated<number>
  correlation_id: ColumnType<string>
  trip_id: ColumnType<string | undefined>
  status: ColumnType<JourneyStatus>
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
 * @internal
 */
export type Journey = Selectable<XcJourneyTable>
export type NewJourney = Insertable<XcJourneyTable>
export type JourneyUpdate = Updateable<XcJourneyTable>

/**
 * @internal
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
 * @internal
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
 * @internal
 */
export type FullJourneyAsset = Omit<AssetOperation, 'id' | 'journey_id'>

/**
 * @internal
 */
export type FullJourney = Journey & {
  totalUsd: number
  assets: FullJourneyAsset[]
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
