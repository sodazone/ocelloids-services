import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api'
import { DailyDuckDBExporter } from './exporter.js'

import { _log } from '@/testing/services.js'
import { XcmTransfersRepository } from './transfers.js'

describe('DuckDBDailyExporter', () => {
  let db: DuckDBConnection
  let exporter: DailyDuckDBExporter

  beforeAll(async () => {
    const instance = await DuckDBInstance.create(':memory:')
    db = await instance.connect()

    const repository = new XcmTransfersRepository(db)
    await repository.migrate()
    const now = Date.now()
    for (let n = 1; n < 10; n++) {
      await repository.insert({
        sentAt: now + 60_000 * n,
        recvAt: now + 60_000 * n + 10_000,
        correlationId: 'hello:hello',
        asset: '0x1234AA',
        destination: 'urn:ocn:polkadot:0',
        origin: 'urn:ocn:polkadot:1',
        from: '0x0101',
        to: '0x0202',
        amount: BigInt(101010101010n * BigInt(n)),
        symbol: 'UWT',
        decimals: 10,
      })
    }

    exporter = new DailyDuckDBExporter(_log, db, 'true')
    await exporter.start()
  })

  beforeEach(async () => {
    await db.run('TRUNCATE TABLE xcm_analytics_export_log;')
  })

  it('should migrate the xcm_analytics_export_log table correctly', async () => {
    const result = await db.run('SELECT * FROM xcm_analytics_export_log;')
    const rows = await result.getRows()
    expect(rows).toHaveLength(0) // Expect no rows before any export has been done
  })

  it('should export data correctly', async () => {
    // Simulate data export
    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setUTCHours(0, 0, 0, 0) // Midnight of current day

    const lastExportTimestamp = startOfToday.getTime() - 1 // Simulate last export at yesterday's midnight

    // Set mock last_exported value to simulate the scenario
    await db.run('INSERT INTO xcm_analytics_export_log VALUES (1, ?);', [BigInt(lastExportTimestamp)])

    // Call the exportData method directly
    await exporter.exportData(() => Promise.resolve())

    // Verify that the export has happened by checking the new `last_exported`
    const result = await db.run('SELECT last_exported FROM xcm_analytics_export_log;')
    const rows = await result.getRows()
    const lastExportedTimestamp = rows[0][0]

    expect(lastExportedTimestamp).toBeGreaterThan(lastExportTimestamp)
  })

  it('should skip export if there is no new data to export', async () => {
    // Simulate data export without updating last_exported
    const startOfToday = new Date()
    startOfToday.setUTCHours(0, 0, 0, 0) // Midnight of current day
    const lastExportTimestamp = BigInt(startOfToday.getTime() - 1) // Simulate last export at yesterday's midnight

    await db.run('INSERT INTO xcm_analytics_export_log VALUES (1, ?);', [lastExportTimestamp])

    // Call exportData, but there should be no new data to export
    await exporter.exportData(() => Promise.resolve())

    // Check if the export was skipped (last_exported should not have changed)
    const result = await db.run('SELECT last_exported FROM xcm_analytics_export_log;')
    const rows = await result.getRows()
    const lastExportedTimestamp = rows[0][0]

    expect(lastExportedTimestamp).toBe(lastExportTimestamp) // Ensure export didn't happen
  })
})
