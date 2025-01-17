import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  try {
    await db.schema
      .createTable('archive')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement().notNull())
      .addColumn('agent', 'integer', (cb) => cb.notNull())
      .addColumn('network', 'integer')
      .addColumn('block_number', 'integer')
      .addColumn('created_at', 'timestamp', (cb) => cb.notNull().defaultTo(sql`current_timestamp`))
      .addColumn('payload', 'json', (cb) => cb.notNull())
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
