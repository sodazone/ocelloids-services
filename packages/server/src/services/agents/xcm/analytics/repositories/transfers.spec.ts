import { fromDuckDBBlob } from '@/common/util.js'
import { DuckDBBlobValue, DuckDBInstance } from '@duckdb/node-api'
import { XcmTransfersRepository } from './transfers.js'

describe('XcmTransfersRepository', async () => {
  const db = await DuckDBInstance.create(':memory:')
  const repository = new XcmTransfersRepository(await db.connect())

  it('should insert data', async () => {
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
    const result = await repository.all()
    expect(result[0].length).toBeGreaterThan(8)
    expect(fromDuckDBBlob(result[0][1] as DuckDBBlobValue)).toBe('hello:hello')
    expect(fromDuckDBBlob(result[0][4] as DuckDBBlobValue)).toBe('0x1234AA')
  })
})
