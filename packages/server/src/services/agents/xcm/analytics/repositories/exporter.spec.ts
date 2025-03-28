import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api'
import { ExportDateManager } from './exporter.js'

describe('ExportDateManager', () => {
  let db: DuckDBConnection

  beforeAll(async () => {
    const instance = await DuckDBInstance.create(':memory:')
    db = await instance.connect()

    const exportDateManager = new ExportDateManager(db, 'daily')
    await exportDateManager.migrate()
  })

  beforeEach(async () => {
    await db.run('TRUNCATE TABLE export_log;')
  })

  it('should calculate the cutoff date correctly for daily interval', () => {
    const exportDateManager = new ExportDateManager(db, 'daily')
    const cutoffDate = exportDateManager.getCutoffDate()
    const expectedDate = new Date()
    expectedDate.setUTCHours(0, 0, 0, 0)
    expectedDate.setUTCDate(expectedDate.getUTCDate() - 1)

    expect(cutoffDate.getUTCDate()).toBe(expectedDate.getUTCDate())
    expect(cutoffDate.getUTCMonth()).toBe(expectedDate.getUTCMonth())
    expect(cutoffDate.getUTCFullYear()).toBe(expectedDate.getUTCFullYear())
  })

  it('should calculate the cutoff date correctly for hourly interval', () => {
    const exportDateManager = new ExportDateManager(db, 'hourly')
    const cutoffDate = exportDateManager.getCutoffDate()

    const expectedDate = new Date()
    expectedDate.setUTCMilliseconds(0)
    expectedDate.setUTCMinutes(0, 0, 0)
    expectedDate.setUTCHours(expectedDate.getUTCHours() - 1)

    expect(cutoffDate.getUTCDate()).toBe(expectedDate.getUTCDate())
    expect(cutoffDate.getUTCMonth()).toBe(expectedDate.getUTCMonth())
    expect(cutoffDate.getUTCFullYear()).toBe(expectedDate.getUTCFullYear())
    expect(cutoffDate.getUTCHours()).toBe(expectedDate.getUTCHours())
  })

  it('should calculate the cutoff date correctly for weekly interval', () => {
    const exportDateManager = new ExportDateManager(db, 'weekly')
    const cutoffDate = exportDateManager.getCutoffDate()

    const expectedDate = new Date()
    expectedDate.setUTCHours(0, 0, 0, 0)
    expectedDate.setUTCDate(expectedDate.getUTCDate() - expectedDate.getUTCDay())

    expect(cutoffDate.getUTCDate()).toBe(expectedDate.getUTCDate())
    expect(cutoffDate.getUTCMonth()).toBe(expectedDate.getUTCMonth())
    expect(cutoffDate.getUTCFullYear()).toBe(expectedDate.getUTCFullYear())
  })

  it('should set the last export date correctly in the database', async () => {
    const newDate = '2025-03-26T00:00:00Z'
    const exportDateManager = new ExportDateManager(db, 'daily')
    await exportDateManager.setLastExportDate(newDate)

    const lastExportDate = await exportDateManager.getLastExportDate()
    expect(lastExportDate).toBe(newDate)
  })

  it('should return null if no last export date is set for daily interval', async () => {
    const exportDateManager = new ExportDateManager(db, 'daily')
    const lastExportDate = await exportDateManager.getLastExportDate()
    expect(lastExportDate).toBeNull()
  })
})
