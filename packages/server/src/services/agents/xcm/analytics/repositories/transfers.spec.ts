import { DuckDBInstance } from '@duckdb/node-api'
import { XcmTransfersRepository } from './transfers.js'

describe('XcmTransfersRepository', async () => {
  const db = await DuckDBInstance.create(':memory:')
  const repository = new XcmTransfersRepository(await db.connect())

  it('should insert data', async () => {
    await repository.migrate()
    for (let n = 1; n < 100; n++) {
      await repository.insert({
        sentAt: Date.now() + 60_000 * n,
        recvAt: Date.now() + 60_000 * n + 10_000,
        correlationId: '0x000',
        asset: '0x000',
        destination: 'polkadot:0',
        origin: 'polkadot:1',
        from: 'xxxx',
        to: 'kkkk',
        amount: BigInt(101010101010n * BigInt(n)),
        symbol: 'UWT',
        decimals: 10,
      })
    }
    console.log(await repository.all())
    console.log(
      await repository.amountByAsset({
        timeframe: '1 days',
      }),
    )
  })
})
