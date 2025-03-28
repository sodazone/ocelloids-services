import { Logger } from '@/services/types.js'
import { DuckDBConnection } from '@duckdb/node-api'

function toISODate(date?: string) {
  if (date) {
    return `${date.split(' ').join('T')}Z`
  }
  return date
}

export class ExportDateManager {
  private db: DuckDBConnection
  private interval: 'hourly' | 'daily' | 'weekly'

  constructor(db: DuckDBConnection, interval: 'hourly' | 'daily' | 'weekly') {
    this.db = db
    this.interval = interval
  }

  async migrate() {
    return await this.db.run(
      'CREATE TABLE IF NOT EXISTS export_log (interval TEXT PRIMARY KEY, last_exported TIMESTAMP);',
    )
  }

  getCutoffDate() {
    const nowUTC = new Date(Date.now())

    return this.#applyInterval(nowUTC, {
      daily: -1,
      hourly: -1,
      weekly: -nowUTC.getUTCDay(),
    })
  }

  async getLastExportDate() {
    const rows = await (
      await this.db.run('SELECT last_exported FROM export_log WHERE interval = ?;', [this.interval])
    ).getRows()
    return toISODate(rows[0]?.[0]?.toString()) ?? null
  }

  async setLastExportDate(date: string) {
    await this.db.run(
      'INSERT INTO export_log (interval, last_exported) VALUES (?, ?) ON CONFLICT(interval) DO UPDATE SET last_exported = excluded.last_exported;',
      [this.interval, date],
    )
  }

  async calculateNextExport() {
    const lastExport = await this.getLastExportDate()
    const nextExport = new Date(lastExport ?? Date.now())

    return this.#applyInterval(nextExport, {
      hourly: 2,
      daily: 2,
      weekly: 14,
    })
  }

  getMaxStartDate() {
    const startDateLimit = new Date(this.getCutoffDate())

    return this.#applyInterval(startDateLimit, {
      hourly: -1,
      daily: -1,
      weekly: -7,
    })
  }

  #applyInterval(from: Date, increments: { hourly: number; daily: number; weekly: number }) {
    switch (this.interval) {
      case 'hourly':
        from.setUTCMinutes(0, 0, 0)
        from.setUTCHours(from.getUTCHours() + increments.hourly)
        break
      case 'daily':
        from.setUTCHours(0, 0, 0, 0)
        from.setUTCDate(from.getUTCDate() + increments.daily)
        break
      case 'weekly':
        from.setUTCHours(0, 0, 0, 0)
        from.setUTCDate(from.getUTCDate() + increments.weekly)
        break
      default:
        throw new Error(`Unsupported interval: ${this.interval}`)
    }

    return from
  }
}

type Intervals = 'hourly' | 'daily' | 'weekly'

/**
 * Manages periodic exports with interval-based cutoff dates, scheduling,
 * and persistence in DuckDB.
 */
export class DuckDBExporter {
  readonly id = 'duckdb:exporter'

  readonly #log
  readonly #db
  readonly #bucket
  readonly #interval: Intervals
  readonly #exportDateManager

  #enabled

  constructor(log: Logger, db: DuckDBConnection, interval?: Intervals) {
    this.#log = log
    this.#db = db
    this.#bucket = process.env.DUCKDB_EXPORTS_BUCKET ?? 'xcm-data'
    this.#interval = interval ?? ((process.env.DUCKDB_EXPORTS_INTERVAL ?? 'daily') as Intervals)
    this.#enabled = (process.env.DUCKDB_EXPORTS ?? 'false') === 'true'
    this.#exportDateManager = new ExportDateManager(db, this.#interval)
  }

  async start() {
    const keyId = process.env.R2_KEY_ID
    const secret = process.env.R2_SECRET
    const accountId = process.env.R2_ACCOUNT_ID

    if ([keyId, secret, accountId].every(Boolean)) {
      try {
        this.#log.info('[%s] Initializing DuckDB R2 exporter', this.id)

        await this.#db.run('INSTALL httpfs;')
        await this.#db.run('LOAD httpfs;')
        await this.#db.run(
          `CREATE SECRET r2exporter (TYPE r2, KEY_ID '${keyId}', SECRET '${secret}', ACCOUNT_ID '${accountId}');`,
        )
        await this.#exportDateManager.migrate()
        await this.#scheduleNextExport()
      } catch (error) {
        this.#enabled = false
        this.#log.error(error, '[%s] Initialization failed', this.id)
      }
    } else {
      this.#enabled = false
    }
  }

  async #scheduleNextExport() {
    if (!this.#enabled) {
      return
    }

    const nextExport = await this.#exportDateManager.calculateNextExport()
    const delay = Math.max(nextExport.getTime() - Date.now(), 1_000)

    this.#log.info(
      '[%s] Scheduled next export for %s at %s in %d ms (%s)',
      this.id,
      this.#interval,
      nextExport.toISOString(),
      delay,
      new Date(Date.now() + delay).toISOString(),
    )

    setTimeout(async () => {
      try {
        await this.exportData()
        await this.#scheduleNextExport()
      } catch (error) {
        this.#log.error(error, '[%s] While executing scheduled export', this.id)
      }
    }, delay).unref()
  }

  async exportData() {
    if (!this.#enabled) {
      return
    }

    const interval = this.#interval
    const cutoffDate = this.#exportDateManager.getCutoffDate()
    const lastExportDate = await this.#exportDateManager.getLastExportDate()

    const startDate = lastExportDate
      ? lastExportDate
      : this.#exportDateManager.getMaxStartDate().toISOString()
    const endDate = cutoffDate.toISOString()

    this.#log.info('[%s] Exporting %s from %s to %s', this.id, interval, startDate, endDate)

    let filename = `xcm-transfers_v1_${interval}_${endDate.slice(0, 10).replace(/-/g, '')}`

    if (interval === 'hourly') {
      const hour = endDate.slice(11, 13)
      filename += `_${hour}`
    }

    filename += '.parquet'

    await this.#db.run(
      `COPY (SELECT * FROM transfers WHERE sent_at > '${startDate}' AND sent_at <= '${endDate}') TO 'r2://${this.#bucket}/${filename}' (FORMAT parquet);`,
    )

    await this.#exportDateManager.setLastExportDate(endDate)

    this.#log.info('[%s] Exported to %s', this.id, filename)
  }
}
