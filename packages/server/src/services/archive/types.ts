import { ColumnType, Generated, Insertable, JSONColumnType, Selectable, Updateable } from 'kysely'

export interface HistoricalPayloadsTable {
  id: Generated<number>
  network: ColumnType<number>
  agent: ColumnType<number>
  block_number: ColumnType<number>
  payload: JSONColumnType<any>
  created_at: ColumnType<Date, string | undefined, never>
}

export type HistoricalPayload = Selectable<HistoricalPayloadsTable>
export type NewHistoricalPayload = Insertable<HistoricalPayloadsTable>
export type HistoricalPayloadUpdate = Updateable<HistoricalPayloadsTable>

export interface Database {
  archive: HistoricalPayloadsTable
}
