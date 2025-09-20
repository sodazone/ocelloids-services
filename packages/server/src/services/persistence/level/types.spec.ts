import { LevelDB } from '@/services/types.js'
import { createServices } from '@/testing/services.js'

describe('Level DB types', () => {
  let db: LevelDB
  beforeAll(async () => {
    const services = createServices()
    db = services.openLevelDB<Buffer, Buffer>('test', { valueEncoding: 'buffer', keyEncoding: 'buffer' })
  })
  test('can use binary keys and values', async () => {
    await db.put(Buffer.from('key'), Buffer.from([0xba, 0xfa, 0xee]))
    const v = await db.get(Buffer.from('key'))
    expect(v?.at(1)).toBe(0xfa)
  })
})
