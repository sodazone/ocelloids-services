import { sql } from 'kysely'
import { lastValueFrom } from 'rxjs'
import { createArchiveDatabase } from './db.js'
import { ArchiveRepository } from './repository.js'
import { NewHistoricalPayload } from './types.js'

describe('ArchiveRepository', () => {
  const { db, migrator } = createArchiveDatabase(':memory:')
  const repository = new ArchiveRepository(db)
  let _payloads: NewHistoricalPayload[] = []

  function createLog(i: number) {
    return {
      agent: 0,
      block_number: i,
      network: 0,
      payload: JSON.stringify({
        ten: 10,
        header: {
          id: i,
          name: `x${i}`,
        },
      }),
    }
  }

  beforeAll(async () => {
    await migrator.migrateToLatest()
    _payloads = Array(10)
      .fill(0)
      .map((_, i) => createLog(i))
  })

  afterEach(async () => {
    await sql`delete from ${sql.table('archive')}`.execute(db)
  })

  afterAll(async () => {
    await migrator.migrateDown()
  })

  it('should insert a payload', async () => {
    const newLog = await repository.insertLogs(_payloads[0])
    expect(newLog.id).toBeDefined()
    expect(newLog.created_at).toBeDefined()
    expect(newLog.payload.header.name).toBe('x0')
  })

  it('should find payloads', async () => {
    await repository.insertLogs(..._payloads)
    const logs = await repository.findLogs({
      startBlock: 1,
      endBlock: 2,
    })
    expect(logs.length).toBe(2)
  })

  it('should stream payloads', async () => {
    await repository.insertLogs(..._payloads)

    const log = await lastValueFrom(await repository.logs$())
    expect(log.block_number).toBe(9)
  })
})
