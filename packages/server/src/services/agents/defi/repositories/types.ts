import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
import { DefiEventAction } from '../types.js'

export type PoolKey = {
  network: string
  protocol: string
  market_id: string
}

export interface DefiPoolTable {
  id: Generated<number>
  category: ColumnType<string>

  protocol: ColumnType<string>
  network: ColumnType<string>
  market_id: ColumnType<string>
}

export interface DefiPoolAssetTable {
  id: Generated<number>
  pool_id: ColumnType<number>

  asset_id: ColumnType<string>
  symbol: ColumnType<string>
  decimals: ColumnType<number>

  balance_total: ColumnType<string | null>
  balance_available: ColumnType<string | null>
  balance_borrowed: ColumnType<string | null>

  reserves: ColumnType<string>
  price_usd: ColumnType<number | null>

  role: ColumnType<string | null>
}

export type DefiPool = Selectable<DefiPoolTable>
export type NewDefiPool = Insertable<DefiPoolTable>
export type DefiPoolUpdate = Updateable<DefiPoolTable>

export type DefiPoolAsset = Selectable<DefiPoolAssetTable>
export type NewDefiPoolAsset = Insertable<DefiPoolAssetTable>
export type DefiPoolAssetUpdate = Updateable<DefiPoolAssetTable>

export interface DefiEventTable {
  id: Generated<number>
  pool_id: ColumnType<number | null>

  network_id: ColumnType<string>
  protocol: ColumnType<string>
  market_id: ColumnType<string>

  block_number: ColumnType<string>
  tx_hash: ColumnType<string>

  event_name: ColumnType<DefiEventAction>
  actor_address: ColumnType<string>
  lp_amount: ColumnType<string | null>
}

export interface DefiEventAssetTable {
  id: Generated<number>
  event_id: ColumnType<number>

  asset_id: ColumnType<string>
  symbol: ColumnType<string>

  amount: ColumnType<string>
  amount_usd: ColumnType<number | null>

  direction: ColumnType<'in' | 'out' | 'action'>
}

export type DefiEvent = Selectable<DefiEventTable>
export type NewDefiEvent = Insertable<DefiEventTable>
export type DefiEventUpdate = Updateable<DefiEventTable>

export type DefiEventAsset = Selectable<DefiEventAssetTable>
export type NewDefiEventAsset = Insertable<DefiEventAssetTable>

export interface DefiDatabase {
  defi_pool: DefiPoolTable
  defi_pool_asset: DefiPoolAssetTable
  defi_event: DefiEventTable
  defi_event_asset: DefiEventAssetTable
}
