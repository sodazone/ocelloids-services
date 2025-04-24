import { Kysely, SelectQueryBuilder } from 'kysely'
import { Observable, Subject, from, last, merge, mergeMap } from 'rxjs'

import { asDateRange, asUTC, toUTCString } from './time.js'
import { Database, HistoricalQuery, NewHistoricalPayload } from './types.js'

type SelectLog = SelectQueryBuilder<Database, 'archive', unknown>

function withCriteria({ timeframe, top, agent }: Partial<HistoricalQuery>, select: SelectLog) {
  let s = select

  if (agent !== undefined) {
    s = s.where('agent', '=', agent)
  }

  if (top !== undefined) {
    s = s.limit(top)
  } else if (timeframe !== undefined) {
    const { start, end } = asDateRange(timeframe)
    if (start !== undefined) {
      s = s.where('created_at', '>=', toUTCString(start))
    }
    if (end !== undefined) {
      s = s.where('created_at', '<=', toUTCString(end))
    }
  }

  return s
}

export class ArchiveRepository {
  readonly #db: Kysely<Database>

  constructor(db: Kysely<Database>) {
    this.#db = db
  }

  async insertLogs(...log: NewHistoricalPayload[]) {
    return await this.#db.insertInto('archive').values(log).returningAll().executeTakeFirstOrThrow()
  }

  async iterateLogs(q: Partial<HistoricalQuery> = {}) {
    return await withCriteria(q, this.#db.selectFrom('archive')).selectAll().stream(q.options?.chunkSize)
  }

  async lastKnownTime(agent?: string) {
    let s = this.#db.selectFrom('archive').select('created_at')
    if (agent !== undefined) {
      s = s.where('agent', '=', agent)
    }
    const { created_at } = await s.orderBy('id', 'desc').limit(1).executeTakeFirstOrThrow()
    return asUTC(created_at)
  }

  async cleanUpOldLogs(olderThan: Date | number | string) {
    return await this.#db.deleteFrom('archive').where('created_at', '<', toUTCString(olderThan)).execute()
  }

  withHistory<T>(realTime$: Observable<T>, q: Partial<HistoricalQuery> = {}) {
    if (q.top !== undefined) {
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

      return merge(
        stream,
        stream.pipe(
          last(),
          mergeMap(() => realTime$),
        ),
      )
    }

    if (q.timeframe === undefined) {
      return realTime$
    }

    const dateRange = asDateRange(q.timeframe)

    if (dateRange.end !== undefined) {
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
      return this.#historicalAndFollow(q, realTime$)
    }
  }

  async logs$(q: Partial<HistoricalQuery> = {}) {
    return from(await this.iterateLogs(q))
  }

  async findLogs(q: Partial<HistoricalQuery> = {}) {
    return await withCriteria(q, this.#db.selectFrom('archive')).selectAll().execute()
  }

  #historicalAndFollow<T>(q: Partial<HistoricalQuery>, realTime$: Observable<T>) {
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
          try {
            const lkt = await this.lastKnownTime(q.agent)
            if (lkt > lastTime) {
              const nq: Partial<HistoricalQuery> = {
                options: q.options,
                agent: q.agent,
                timeframe: {
                  start: new Date(lastTime).toISOString(),
                },
              }
              followHistorical(await this.logs$(nq))
            } else {
              stream.complete()
            }
          } catch {
            // complete on error
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
