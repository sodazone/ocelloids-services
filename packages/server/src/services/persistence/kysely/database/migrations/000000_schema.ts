import { Kysely, sql } from 'kysely'

import { CAP_ADMIN, CAP_READ, CAP_WRITE } from '@/services/auth.js'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('account')
    .ifNotExists()
    .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement().notNull())
    .addColumn('subject', 'varchar(255)', (cb) => cb.notNull().unique())
    .addColumn('status', 'varchar(50)', (cb) => cb.notNull().defaultTo('enabled'))
    .addColumn('created_at', 'timestamp', (cb) => cb.notNull().defaultTo(sql`current_timestamp`))
    .execute()

  await db.schema
    .createTable('api-token')
    .ifNotExists()
    .addColumn('id', 'char(26)', (col) => col.primaryKey())
    .addColumn('name', 'text')
    .addColumn('scope', 'text', (col) => col.notNull())
    .addColumn('account_id', 'integer', (col) => col.references('account.id').onDelete('cascade').notNull())
    .addColumn('status', 'varchar(50)', (cb) => cb.notNull().defaultTo('enabled'))
    .addColumn('created_at', 'timestamp', (cb) => cb.notNull().defaultTo(sql`current_timestamp`))
    .execute()

  await db.schema.createIndex('account_subject_index').ifNotExists().on('account').column('subject').execute()
  await db.schema
    .createIndex('api-token_account_id_index')
    .ifNotExists()
    .on('api-token')
    .column('account_id')
    .execute()

  const rootAccount = await db
    .insertInto('account')
    .values({
      subject: 'root@ocelloids',
      name: 'root',
    })
    .executeTakeFirst()

  await db
    .insertInto('api-token')
    .values({
      id: '00000000000000000000000000',
      account_id: rootAccount.insertId,
      scope: [CAP_ADMIN, CAP_WRITE, CAP_READ].join(' '),
    })
    .executeTakeFirst()

  const readOnlyAccount = await db
    .insertInto('account')
    .values({
      subject: 'public@ocelloids',
      name: 'public read only',
    })
    .executeTakeFirst()

  await db
    .insertInto('api-token')
    .values({
      id: '01000000000000000000000000',
      account_id: readOnlyAccount.insertId,
      scope: [CAP_READ].join(' '),
    })
    .executeTakeFirst()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('account').execute()
  await db.schema.dropTable('api-token').execute()
}
