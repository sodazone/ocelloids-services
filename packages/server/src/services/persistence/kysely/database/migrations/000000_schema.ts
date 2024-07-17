import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('account')
    .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement().notNull())
    .addColumn('subject', 'varchar(255)', (cb) => cb.notNull())
    .addColumn('status', 'varchar(50)', (cb) => cb.notNull().defaultTo('enabled'))
    .addColumn('created_at', 'timestamp', (cb) => cb.notNull().defaultTo(sql`current_timestamp`))
    .execute()

  await db.schema
    .createTable('api-token')
    .addColumn('id', 'integer', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .addColumn('token', 'text', (col) => col.notNull().unique())
    .addColumn('account_id', 'integer', (col) => col.references('account.id').onDelete('cascade').notNull())
    .addColumn('status', 'varchar(50)', (cb) => cb.notNull().defaultTo('enabled'))
    .addColumn('created_at', 'timestamp', (cb) => cb.notNull().defaultTo(sql`current_timestamp`))
    .execute()

  await db.schema.createIndex('api-token_account_id_index').on('api-token').column('account_id').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('account').execute()
  await db.schema.dropTable('api-token').execute()
}
