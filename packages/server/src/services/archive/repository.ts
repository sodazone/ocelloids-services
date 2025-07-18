import { Kysely, SelectQueryBuilder } from 'kysely'
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  concatMap,
  defer,
  delay,
  expand,
  from,
  last,
  merge,
  mergeMap,
  of,
  throwError,
} from 'rxjs'

import { asDateRange, asUTC, toUTCMillis, toUTCString } from './time.js'
import { Database, HistoricalPayload, HistoricalQuery, NewHistoricalPayload } from './types.js'

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

  logs$(q: Partial<HistoricalQuery> = {}, chunkSize = 20): Observable<HistoricalPayload> {
    let offset = 0

    const fetchPage = (offset: number) =>
      defer(() =>
        from(
          withCriteria(q, this.#db.selectFrom('archive'))
            .selectAll()
            .limit(chunkSize)
            .offset(offset)
            .execute(),
        ),
      )

    return fetchPage(offset).pipe(
      expand((rows) => {
        if (rows.length < chunkSize) {
          return EMPTY
        }
        offset += chunkSize
        return fetchPage(offset).pipe(delay(0))
      }),
      concatMap((rows) => from(rows).pipe(concatMap((row) => of(row).pipe(delay(0))))),
    )
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
      this.logs$(q).subscribe({
        next: ({ payload }) => {
          stream.next(payload)
        },
        error: (err) => {
          stream.error(err)
        },
        complete: () => {
          stream.complete()
        },
      })

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
      this.logs$(q).subscribe({
        next: ({ payload }) => {
          stream.next(payload)
        },
        error: (err) => {
          stream.error(err)
        },
        complete: () => {
          stream.complete()
        },
      })

      return stream
    } else {
      return this.#historicalAndFollow(q, realTime$)
    }
  }

  async findLogs(q: Partial<HistoricalQuery> = {}) {
    return await withCriteria(q, this.#db.selectFrom('archive')).selectAll().execute()
  }

  #historicalAndFollow<T>(q: Partial<HistoricalQuery>, realTime$: Observable<T>) {
    const stream = new Subject<T>()
    const startDate = q.timeframe === undefined ? 0 : (asDateRange(q.timeframe).start ?? 0)
    let lastTime = toUTCMillis(startDate)
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
              followHistorical(this.logs$(nq))
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

    followHistorical(this.logs$(q))

    return merge(
      stream,
      stream.pipe(
        last(),
        mergeMap(() => realTime$),
        catchError((err) => {
          if (err.name === 'EmptyError') {
            return realTime$
          }
          return throwError(() => err)
        }),
      ),
    )
  }
}
