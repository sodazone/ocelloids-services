import { Kysely, SelectQueryBuilder } from 'kysely'
import { from } from 'rxjs'

import { Database, NewHistoricalPayload } from './types.js'

type HistoricalQuery = {
  startBlock?: number
  endBlock?: number
  chunkSize?: number
}

type SelectLog = SelectQueryBuilder<Database, 'archive', unknown>

function withCriteria({ startBlock, endBlock }: HistoricalQuery, select: SelectLog) {
  let s = select
  if (startBlock !== undefined) {
    s = s.where('block_number', '>=', startBlock)
  }
  if (endBlock !== undefined) {
    s = s.where('block_number', '<=', endBlock)
  }
  return s.orderBy('block_number')
}

export class ArchiveRepository {
  readonly #db: Kysely<Database>

  constructor(db: Kysely<Database>) {
    this.#db = db
  }

  async insertLogs(...log: NewHistoricalPayload[]) {
    return await this.#db.insertInto('archive').values(log).returningAll().executeTakeFirstOrThrow()
  }

  async iterateLogs(q: HistoricalQuery = {}) {
    return await withCriteria(q, this.#db.selectFrom('archive')).selectAll().stream(q.chunkSize)
  }

  async logs$(q: HistoricalQuery = {}) {
    return from(await this.iterateLogs(q))
  }

  async findLogs(q: HistoricalQuery = {}) {
    return await withCriteria(q, this.#db.selectFrom('archive')).selectAll().execute()
  }
}
