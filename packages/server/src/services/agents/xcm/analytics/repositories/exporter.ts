import { Logger } from '@/services/types.js'
import { DuckDBConnection } from '@duckdb/node-api'

export class DailyDuckDBExporter {
  readonly id = 'duckdb:exporter'
  readonly #log
  readonly #db
  readonly #bucket

  #enabled
  #lastExportTimestamp: number | null = null

  constructor(log: Logger, db: DuckDBConnection, fallback = 'false') {
    this.#log = log
    this.#db = db
    this.#bucket = process.env.DUCKDB_EXPORTS_BUCKET ?? 'xcm-data'
    this.#enabled = (process.env.DUCKDB_EXPORTS ?? fallback) === 'true'
  }

  async start() {
    if (!this.#enabled) {
      return
    }

    try {
      this.#log.info('[%s] Initializing DuckDB exporter', this.id)
      await this.#db.run('INSTALL httpfs;')
      await this.#db.run('LOAD httpfs;')
      await this.#migrate()
      await this._scheduleNextExport()
    } catch (error) {
      this.#enabled = false
      this.#log.error(error, '[%s] Initialization failed', this.id)
    }
  }

  async #migrate() {
    await this.#db.run(
      'CREATE TABLE IF NOT EXISTS xcm_analytics_export_log (id INTEGER PRIMARY KEY, last_exported BIGINT);',
    )

    const result = await this.#db.run('SELECT last_exported FROM xcm_analytics_export_log;')
    const rows = await result.getRows()

    this.#lastExportTimestamp = rows.length > 0 ? Number(rows[0][0]) : null
  }

  async _scheduleNextExport() {
    if (!this.#enabled) {
      return
    }

    const now = new Date()
    const nextExport = new Date(now)
    nextExport.setUTCHours(0, 0, 0, 0) // Set to midnight UTC
    nextExport.setUTCDate(nextExport.getUTCDate() + 1) // Schedule for next day

    const delay = Math.max(nextExport.getTime() - now.getTime(), 1000)

    this.#log.info(
      '[%s] Scheduled next export at %s in %d ms (%s)',
      this.id,
      nextExport.toISOString(),
      delay,
      new Date(Date.now() + delay).toISOString(),
    )

    setTimeout(async () => {
      try {
        await this.exportData(async ({ filename, startTimestamp, endTimestamp }) => {
          await this.#db.run(
            `COPY (SELECT * FROM xcm_transfers WHERE sent_at >= epoch_ms(${startTimestamp}) AND sent_at < epoch_ms(${endTimestamp}))
             TO 'r2://${this.#bucket}/${filename}' (FORMAT parquet);`,
          )
        })
        await this._scheduleNextExport()
      } catch (error) {
        this.#log.error(error, '[%s] While executing scheduled export', this.id)
      }
    }, delay).unref()
  }

  async exportData(
    onExport: (args: { filename: string; startTimestamp: number; endTimestamp: number }) => Promise<void>,
  ) {
    if (!this.#enabled) {
      return
    }

    const now = new Date()
    now.setUTCHours(0, 0, 0, 0) // Start of today (UTC)
    const startDate = new Date(now)
    startDate.setUTCDate(startDate.getUTCDate() - 1) // Previous day

    const startTimestamp = startDate.getTime()
    const endTimestamp = now.getTime()

    if (this.#lastExportTimestamp && this.#lastExportTimestamp >= endTimestamp) {
      this.#log.info('[%s] No new data to export. Skipping.', this.id)
      return
    }

    this.#log.info('[%s] Exporting from %d to %d', this.id, startTimestamp, endTimestamp)

    const filename = `xcm-transfers_${startDate.toISOString().slice(0, 10).replace(/-/g, '')}.parquet`

    await onExport({ filename, startTimestamp, endTimestamp })

    await this.#db.run(
      'INSERT INTO xcm_analytics_export_log VALUES (?, ?) ON CONFLICT DO UPDATE SET last_exported = EXCLUDED.last_exported;',
      [1, BigInt(endTimestamp)],
    )

    this.#lastExportTimestamp = endTimestamp

    this.#log.info('[%s] Exported to %s', this.id, filename)
  }
}
