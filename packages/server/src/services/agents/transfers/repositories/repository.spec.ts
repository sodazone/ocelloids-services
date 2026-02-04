import { mapTransferToRow } from '../convert.js'
import { EnrichedTransfer } from '../types.js'
import { createIntrachainTransfersDatabase } from './db.js'
import { IntrachainTransfersRepository } from './repository.js'

describe('IntrachainTransfersRepository', () => {
  let repo: IntrachainTransfersRepository

  beforeEach(async () => {
    const { db, migrator } = createIntrachainTransfersDatabase(':memory:')
    repo = new IntrachainTransfersRepository(db)
    await migrator.migrateToLatest()
  })

  afterEach(async () => {
    await repo.close()
  })

  function makeTransfer(overrides: Partial<EnrichedTransfer> = {}): EnrichedTransfer {
    return {
      chainId: 'urn:ocn:polkadot:1000',
      blockHash: '0x0102',
      blockNumber: '12345',
      from: '0x3aba38f68f66ae8417386e23081ec3b12957d03c9dcf7d0db4c1d77637f6ca5e',
      fromFormatted: '12L16d9ttZYMwJtdjezNAbro94DhPJoYYQnsvuJNyzaYZcsW',
      to: '0xc0148b7dca510b3503430124159383bb6464cf98dee021cdc762316e44aa1000',
      toFormatted: '15LrJE1PJRFofvZVyxaf4s8Q1YauxGZMxMXy79di1AqE7KZq',
      asset: 'native',
      amount: '10000000000',
      decimals: 10,
      symbol: 'DOT',
      volume: 1.76,
      timestamp: Date.now(),
      event: {
        blockPosition: 5,
        module: 'balances',
        name: 'transfer',
        value: {},
      },
      extrinsic: {
        hash: '0x14be5b38dcdc2e8fad87ac54ed5e254813ea4f07bdc8a93d8d22fac6f898f306',
      },
      ...overrides,
    }
  }

  it('should insert a transfer and retrieve it', async () => {
    const transfer = makeTransfer()
    const inserted = await repo.insertTransfer(mapTransferToRow(transfer))
    expect(inserted).toBeDefined()
    expect(inserted).not.toBeNull()

    const fetched = await repo.getTransferById(inserted!.id)
    expect(fetched).toBeDefined()
    expect(fetched!.id).toBe(inserted!.id)
  })

  it('should not insert a duplicate emitted from another event', async () => {
    const transfer = makeTransfer()
    const duplicate = makeTransfer({
      event: {
        blockPosition: 9,
        module: 'another',
        name: 'transfer',
        value: {},
      },
    })

    const inserted = await repo.insertTransfer(mapTransferToRow(transfer))
    expect(inserted).toBeDefined()
    expect(inserted).not.toBeNull()

    const notInserted = await repo.insertTransfer(mapTransferToRow(duplicate))
    expect(notInserted).toBeNull()

    const { nodes } = await repo.listTransfers()
    expect(nodes.length).toBe(1)
  })
})
