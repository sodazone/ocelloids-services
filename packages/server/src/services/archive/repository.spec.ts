import { sql } from 'kysely'
import { lastValueFrom } from 'rxjs'
import { createArchiveDatabase } from './db.js'
import { ArchiveRepository } from './repository.js'
import { NewHistoricalPayload } from './types.js'

type Payload = {
  a: number
  b: {
    id: number
    name: string
  }
}

describe('ArchiveRepository', () => {
  const { db, migrator } = createArchiveDatabase(':memory:')
  const repository = new ArchiveRepository(db)

  let _payloads: NewHistoricalPayload[] = []

  function createLog(i: number) {
    return {
      agent: 'test',
      block_number: i,
      network: 'urn:ocn:rainbow:1',
      payload: JSON.stringify({
        a: 10,
        b: {
          id: i,
          name: `x${i}`,
        },
      } as Payload),
    }
  }

  beforeAll(async () => {
    await migrator.migrateToLatest()
    _payloads = Array(10)
      .fill(0)
      .map((_, i) => createLog(i))
  })

  afterAll(async () => {
    await migrator.migrateDown()
  })

  afterEach(async () => {
    await sql`delete from ${sql.table('archive')}`.execute(db)
  })

  it('should insert a payload', async () => {
    const newLog = await repository.insertLogs(_payloads[0])
    expect(newLog.id).toBeDefined()
    expect(newLog.created_at).toBeDefined()
    expect(newLog.payload.b.name).toBe('x0')
  })

  it('should find payloads', async () => {
    const now = Date.now()
    await repository.insertLogs(..._payloads)
    const logs = await repository.findLogs({
      timeframe: {
        start: new Date(now - 1_000).toISOString(),
        end: new Date(now + 1_000).toISOString(),
      },
    })
    expect(logs.length).toBeGreaterThan(0)
  })

  it('should get the last timestamp', async () => {
    const now = Date.now()
    await repository.insertLogs(..._payloads)
    const ts = await repository.lastKnownTime()
    expect(ts).toBeGreaterThanOrEqual(now)
  })

  it('should throw on last known time not found', async () => {
    await repository.insertLogs(..._payloads)
    await expect(async () => await repository.lastKnownTime('none')).rejects.toThrow()
  })

  it('should return empty array on empty data', async () => {
    const ts = await repository.findLogs()
    expect(ts).toStrictEqual([])
  })

  it('should stream payloads', async () => {
    await repository.insertLogs(..._payloads)

    const log = await lastValueFrom(await repository.logs$())
    expect(log.block_number).toBe(9)
  })
})
