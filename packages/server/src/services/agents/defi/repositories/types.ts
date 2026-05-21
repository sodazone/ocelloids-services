import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
import { DefiEventAction, DefiLiquidityCategory } from '../types.js'

export type PoolKey = {
  network: string
  protocol: string
  market_id: string
}

export interface DefiPoolTable {
  id: Generated<number>
  category: ColumnType<DefiLiquidityCategory>

  protocol: ColumnType<string>
  network: ColumnType<string>
  market_id: ColumnType<string>

  // lending meta
  borrow_apr: ColumnType<number | null>
  supply_apr: ColumnType<number | null>
  borrow_cap: ColumnType<string | null>
  supply_cap: ColumnType<string | null>
  is_paused: ColumnType<number | boolean | null>
  can_borrow: ColumnType<number | boolean | null>
  bad_debt_usd: ColumnType<number | null>
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

/**
 * DeFi Event asset role.
 *
 * @public
 */
export type DefiEventAssetRole = 'swap_in' | 'swap_out' | 'fee' | 'asset'

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

  role: ColumnType<DefiEventAssetRole>
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
