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
  timeframe: z.optional(
    z.string().or(
      z.object({
        start: z.optional(z.number().positive().or(z.string().datetime())),
        end: z.optional(z.number().positive().or(z.string().datetime())),
      }),
    ),
  ),
  last: z.optional(z.number().positive()),
})

export type Timeframe = {
  start: string | number | Date
  end?: string | number | Date
}

export type HistoricalQueryOptions = {
  chunkSize: number
}

export type HistoricalQuery = {
  agent: string
  timeframe: Partial<Timeframe> | string
  top: number
  options: Partial<HistoricalQueryOptions>
}

export interface Database {
  archive: HistoricalPayloadsTable
}

export type ArchiveRetentionOptions = {
  enabled: boolean
  policy: {
    period: string
    tickMillis: number
  }
}
