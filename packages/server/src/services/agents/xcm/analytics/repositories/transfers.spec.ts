import { DuckDBBlobValue, DuckDBInstance } from '@duckdb/node-api'
import { fromDuckDBBlob } from '@/common/util.js'
import { TimeSelect } from '../../types/index.js'
import { AggregatedData, XcmTransfersRepository } from './transfers.js'

describe('XcmTransfersRepository', async () => {
  const db = await DuckDBInstance.create(':memory:')
  const connection = await db.connect()
  const repository = new XcmTransfersRepository(connection)

  const insertTestData = async (numRecords: number, startTime: number) => {
    for (let n = 1; n <= numRecords; n++) {
      await repository.insert({
        sentAt: startTime + 60_000 * n,
        recvAt: startTime + 60_000 * n + 10_000,
        correlationId: `correlation-${n}`,
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
  }

  beforeAll(async () => {
    await repository.migrate()
  })

  afterAll(async () => {
    await repository.close()
  })

  afterEach(async () => {
    await connection.run('TRUNCATE xcm_transfers;')
  })

  it('should insert data and retrieve it correctly', async () => {
    const now = Date.now()

    await insertTestData(10, now)

    const result = await repository.all()

    expect(result.length).toBeGreaterThan(8)

    expect(fromDuckDBBlob(result[0][1] as DuckDBBlobValue)).toBe('correlation-1')
    expect(fromDuckDBBlob(result[0][4] as DuckDBBlobValue)).toBe('0x1234AA')
  })

  it('should handle empty data set', async () => {
    const result = await repository.all()
    expect(result.length).toBe(0)
  })

  it('should throw an error for unsupported "minutes" timeframe', async () => {
    const criteria = { timeframe: '1 minutes', bucket: '1 hours' }

    try {
      await repository.totalTransfers(criteria as TimeSelect)
    } catch (error) {
      expect((error as Error).message).toBe('unsupported unit 1 minutes')
    }
  })

  it('should calculate totalTransfers correctly with valid time filters', async () => {
    const now = Date.now()

    await insertTestData(5, now)

    const validTimeframes = ['1 days', '7 days', '15 days', '1 months', '4 months']

    for (const timeframe of validTimeframes) {
      const criteria = { timeframe, bucket: '1 hours' } as TimeSelect
      const result = await repository.totalTransfers(criteria)

      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)

      expect(result[0].diff).toBeGreaterThanOrEqual(0)
      expect(result[0].accounts.diff).toBeGreaterThanOrEqual(0)
      expect(result[0].avgTimeSpent.diff).toBeGreaterThanOrEqual(0)
    }
  })

  it.skip('should correctly handle transfersByChannel time aggregation', async () => {
    const now = Date.now()

    await insertTestData(1, now - 60_000 * 5) // 5 minutes ago
    await insertTestData(1, now - 60_000 * 2) // 2 minutes ago
    await insertTestData(1, now - 60_000 * 120) // 2 hours ago
    await insertTestData(1, now - 2_629_746_000) // 1 month ago

    const criteria: TimeSelect = { timeframe: '1 days', bucket: '1 hours' }
    const result = await repository.transfersByChannel(criteria)

    expect(result).toBeDefined()
    expect(result.length).toBe(1)

    const series = (result[0] as AggregatedData).series
    expect(series.length).toBe(2)
    expect(series[0].time).toBeGreaterThan(0)
    expect(series[0].value).toBe(2)
    expect(series[1].value).toBe(1)
  })
})
