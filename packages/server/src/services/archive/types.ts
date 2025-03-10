import { ColumnType, Generated, Insertable, JSONColumnType, Selectable, Updateable } from 'kysely'
import { z } from 'zod'

export interface HistoricalPayloadsTable {
  id: Generated<number>
  network: ColumnType<string>
  agent: ColumnType<string>
  block_number: ColumnType<number>
  payload: JSONColumnType<any>
  created_at: ColumnType<string, never>
}

export type HistoricalPayload = Selectable<HistoricalPayloadsTable>
export type NewHistoricalPayload = Insertable<HistoricalPayloadsTable>
export type HistoricalPayloadUpdate = Updateable<HistoricalPayloadsTable>

export const $HistoricalQuery = z.object({
  startTime: z.optional(z.number().positive().or(z.string().datetime())),
  endTime: z.optional(z.number().positive().or(z.string().datetime())),
})

export type HistoricalQuery = {
  startTime?: string | number | Date
  endTime?: string | number | Date
  chunkSize?: number
}

export interface Database {
  archive: HistoricalPayloadsTable
}
