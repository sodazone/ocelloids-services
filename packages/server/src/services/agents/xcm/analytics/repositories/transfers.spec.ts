import { DuckDBInstance } from '@duckdb/node-api'
import { XcmTransfersRepository } from './transfers.js'

describe('XcmTransfersRepository', async () => {
  const db = await DuckDBInstance.create(':memory:')
  const repository = new XcmTransfersRepository(await db.connect())

  it('should insert data', async () => {
    await repository.migrate()
    for (let n = 1; n < 10; n++) {
      await repository.insert({
        sentAt: Date.now() + 60_000 * n,
        recvAt: Date.now() + 60_000 * n + 10_000,
        correlationId: '0x000',
        asset: '0x000',
        destination: 'urn:ocn:polkadot:0',
        origin: 'urn:ocn:polkadot:1',
        from: '0x01',
        to: '0x02',
        amount: BigInt(101010101010n * BigInt(n)),
        symbol: 'UWT',
        decimals: 10,
      })
    }
    const result = await repository.all()
    expect(result[0].length).toBeGreaterThan(8)
  })
})
