import { Kysely, SelectQueryBuilder } from 'kysely'
import { Observable, Subject, from, last, merge, mergeMap } from 'rxjs'

import { Database, HistoricalQuery, NewHistoricalPayload } from './types.js'

type SelectLog = SelectQueryBuilder<Database, 'archive', unknown>

function asUTC(strTimestamp: string) {
  return new Date(strTimestamp + 'Z').getTime()
}

function p(n: number, max = 2) {
  return n.toString().padStart(max, '0')
}

function toUTCString(date: Date | string | number) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p(d.getUTCMilliseconds(), 3)}`
}

function withCriteria({ startTime, endTime }: HistoricalQuery, select: SelectLog) {
  let s = select
  if (startTime !== undefined) {
    s = s.where('created_at', '>=', toUTCString(startTime))
  }
  if (endTime !== undefined) {
    s = s.where('created_at', '<=', toUTCString(endTime))
  }
  return s.orderBy('created_at')
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

  async lastKnownTime() {
    const { created_at } = await this.#db
      .selectFrom('archive')
      .select('created_at')
      .orderBy('id desc')
      .limit(1)
      .executeTakeFirstOrThrow()
    return asUTC(created_at)
  }

  withHistory<T>(realTime$: Observable<T>, q: HistoricalQuery = {}) {
    if (q.endTime !== undefined) {
      const stream = new Subject<T>()
      this.logs$(q).then((from$) =>
        from$.subscribe({
          next: ({ payload }) => {
            stream.next(payload)
          },
          error: (err) => {
            stream.error(err)
          },
          complete: () => {
            stream.complete()
          },
        }),
      )
      return stream
    } else {
      const stream = new Subject<T>()
      let lastTime = 0
      const followHistorical = (from$: Awaited<ReturnType<typeof this.logs$>>) => {
        from$.subscribe({
          next: ({ created_at, payload }) => {
            lastTime = asUTC(created_at)
            stream.next(payload)
          },
          error: (err) => {
            stream.error(err)
          },
          complete: async () => {
            const lkt = await this.lastKnownTime()
            if (lkt > lastTime) {
              const nq: HistoricalQuery = {
                chunkSize: q.chunkSize,
                startTime: new Date(lastTime).toISOString(),
              }
              followHistorical(await this.logs$(nq))
            } else {
              stream.complete()
            }
          },
        })
      }

      this.logs$(q).then(followHistorical)

      return merge(
        stream,
        stream.pipe(
          last(),
          mergeMap(() => realTime$),
        ),
      )
    }
  }

  async logs$(q: HistoricalQuery = {}) {
    return from(await this.iterateLogs(q))
  }

  async findLogs(q: HistoricalQuery = {}) {
    return await withCriteria(q, this.#db.selectFrom('archive')).selectAll().execute()
  }
}
