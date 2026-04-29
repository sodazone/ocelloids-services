import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'

export type PoolKey = {
  network: string
  protocol: string
  address: string
}

export interface DefiDexPoolTable {
  id: ColumnType<number>
  type: ColumnType<string>

  protocol: ColumnType<string>
  network: ColumnType<string>
  address: ColumnType<string>
}

export interface DefiDexPoolReserveTable {
  id: Generated<number>
  pool_id: ColumnType<number>

  block_number: ColumnType<number>
  block_timestamp: ColumnType<bigint>

  asset_id: ColumnType<string>
  symbol: ColumnType<string>
  decimals: ColumnType<number>

  balance: ColumnType<string>
  usd_value: ColumnType<string | null>

  weight: ColumnType<number | null>
}

export type DefiDexPool = Selectable<DefiDexPoolTable>
export type NewDefiDexPool = Insertable<DefiDexPoolTable>
export type DefiDexPoolUpdate = Updateable<DefiDexPoolTable>

export type DefiDexPoolReserve = Selectable<DefiDexPoolReserveTable>
export type NewDefiDexPoolReserve = Insertable<DefiDexPoolReserveTable>
export type DefiDexPoolReserveUpdate = Updateable<DefiDexPoolReserveTable>

export interface DefiDatabase {
  defi_dex_pool: DefiDexPoolTable
  defi_dex_pool_reserve: DefiDexPoolReserveTable
}
