import { sql } from 'kysely'

import { createSystemDatabase } from './db.js'
import { AccountsRepository } from './repository.js'

describe('AccountsRepository', () => {
  const { db, migrator } = createSystemDatabase(':memory:')
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
