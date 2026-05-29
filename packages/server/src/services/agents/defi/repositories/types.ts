import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
import { DefiEventAction, DefiLiquidityCategory, DefiOrderStatus } from '../types.js'

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
  token_deficit_usd: ColumnType<number | null>
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
export type DefiEventAssetRole =
  | 'swap_in'
  | 'swap_out'
  | 'fee'
  | 'supplied'
  | 'withdrawn'
  | 'borrowed'
  | 'repaid'
  | 'liquidation_debt'
  | 'liquidation_collateral'
  | 'asset'

export interface DefiEventTable {
  id: ColumnType<string>
  pool_id: ColumnType<number | null>

  network_id: ColumnType<string>
  protocol: ColumnType<string>
  market_id: ColumnType<string>

  block_number: ColumnType<string | null>
  block_hash: ColumnType<string | null>
  tx_hash: ColumnType<string | null>

  event_name: ColumnType<DefiEventAction>
  actor_address: ColumnType<string>
  counterparty_address: ColumnType<string | null>
}

export interface DefiEventAssetTable {
  id: Generated<number>
  event_id: ColumnType<string>

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

export interface DefiPriceTable {
  id: Generated<number>
  network: ColumnType<string>
  protocol: ColumnType<string>
  asset_id: ColumnType<string>
  symbol: ColumnType<string>
  decimals: ColumnType<number>
  price_usd: ColumnType<string>
  updated_at: ColumnType<number>
}

export type DefiPrice = Selectable<DefiPriceTable>
export type NewDefiPrice = Insertable<DefiPriceTable>
export type DefiPriceUpdate = Updateable<DefiPriceTable>

export interface DefiOrderTable {
  id: Generated<number>

  network: ColumnType<string>
  protocol: ColumnType<string>
  order_id: ColumnType<string>
  order_key: ColumnType<string>

  owner: ColumnType<string>
  asset_in: ColumnType<string>
  symbol_in: ColumnType<string>
  asset_out: ColumnType<string>
  symbol_out: ColumnType<string>
  amount_in: ColumnType<string | null>
  amount_out: ColumnType<string | null>

  fill_count: ColumnType<number>
  filled_amount_in: ColumnType<string>
  filled_amount_out: ColumnType<string>
  filled_amount_usd: ColumnType<string>
  status: ColumnType<DefiOrderStatus>

  created_block_number: ColumnType<string>
  created_block_hash: ColumnType<string>
  created_at: ColumnType<number>
  created_tx_hash: ColumnType<string | null>
  updated_at_block: ColumnType<string | null>
  updated_at: ColumnType<number | null>
}

export interface DefiOrderFillTable {
  id: Generated<number>
  order_key: ColumnType<string>
  filler: ColumnType<string>
  amount_in: ColumnType<string>
  amount_out: ColumnType<string>
  amount_usd: ColumnType<string | null>
  block_number: ColumnType<string>
  block_hash: ColumnType<string>
  block_event_index: ColumnType<number>
  timestamp: ColumnType<number>
  tx_hash: ColumnType<string | null>
}

export interface DefiDatabase {
  defi_pool: DefiPoolTable
  defi_pool_asset: DefiPoolAssetTable
  defi_event: DefiEventTable
  defi_event_asset: DefiEventAssetTable
  defi_price: DefiPriceTable
  defi_order: DefiOrderTable
  defi_order_fill: DefiOrderFillTable
}
