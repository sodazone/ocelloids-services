import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  try {
    await db.schema
      .createTable('archive')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement().notNull())
      .addColumn('agent', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('network', 'varchar(255)')
      .addColumn('block_number', 'integer')
      .addColumn('created_at', 'timestamp', (cb) => cb.notNull().defaultTo(sql`(datetime('subsec'))`))
      .addColumn('payload', 'json', (cb) => cb.notNull())
      .execute()

    await db.schema.createIndex('archive_time').ifNotExists().on('archive').column('created_at').execute()
    await db.schema
      .createIndex('archive_block_number')
      .ifNotExists()
      .on('archive')
      .column('block_number')
      .execute()
    await db.schema.createIndex('archive_agent_index').ifNotExists().on('archive').column('agent').execute()
    await db.schema
      .createIndex('archive_network_index')
      .ifNotExists()
      .on('archive')
      .column('network')
      .execute()
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('archive').execute()
}
