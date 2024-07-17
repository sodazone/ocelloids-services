import { openDatabase } from '@/services/persistence/kysely/database/db.js'
import { Migration, Migrator, sql } from 'kysely'

import * as initial from '@/services/persistence/kysely/database/migrations/000000_schema.js'
import { AccountsRepository } from './repository.js'

describe('AccountsRepository', () => {
  const db = openDatabase({
    filename: ':memory:',
  })
  const migrator = new Migrator({
    db,
    provider: {
      getMigrations: async (): Promise<Record<string, Migration>> => {
        return {
          '000000': initial,
        }
      },
    },
  })
  const repository = new AccountsRepository(db)

  beforeAll(async () => {
    await migrator.migrateToLatest()
  })

  afterEach(async () => {
    await sql`delete from ${sql.table('account')}`.execute(db)
  })

  afterAll(async () => {
    await migrator.migrateDown()
  })

  it('should find an account with a given id', async () => {
    await repository.findAccountById(123)
  })

  it('should update the status of an account with a given id', async () => {
    await repository.updateAccount(123, { status: 'disabled' })
  })

  it('should create an account', async () => {
    await repository.createAccount({
      subject: 'macario@hello.io',
      status: 'enabled',
    })
  })

  it('should delete an account with a given id', async () => {
    await repository.deleteAccount(123)
  })
})
