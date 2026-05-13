import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'

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
  price_usd: ColumnType<string | null>

  role: ColumnType<string | null>
}

export type DefiPool = Selectable<DefiPoolTable>
export type NewDefiPool = Insertable<DefiPoolTable>
export type DefiPoolUpdate = Updateable<DefiPoolTable>

export type DefiPoolAsset = Selectable<DefiPoolAssetTable>
export type NewDefiPoolAsset = Insertable<DefiPoolAssetTable>
export type DefiPoolAssetUpdate = Updateable<DefiPoolAssetTable>

export interface DefiDatabase {
  defi_pool: DefiPoolTable
  defi_pool_asset: DefiPoolAssetTable
}
