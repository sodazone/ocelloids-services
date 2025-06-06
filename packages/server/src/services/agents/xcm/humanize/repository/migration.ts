import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  try {
    // Create xcm_journeys table
    await db.schema
      .createTable('xcm_journeys')
      .ifNotExists()
      .addColumn('id', 'varchar(255)', (cb) => cb.primaryKey().notNull())
      .addColumn('created_at', 'timestamp', (cb) => cb.notNull().defaultTo(sql`current_timestamp`))
      .execute()

    // Create xcm_legs table
    await db.schema
      .createTable('xcm_legs')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement().notNull())
      .addColumn('journey_id', 'varchar(255)', (cb) =>
        cb.references('xcm_journeys.id').onDelete('cascade').notNull(),
      )
      .addColumn('leg_index', 'integer', (cb) => cb.notNull())
      .addColumn('origin', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('destination', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('sent_at', 'timestamp', (cb) => cb.notNull())
      .addColumn('recv_at', 'timestamp', (cb) => cb.notNull())
      .addColumn('outcome', 'text', (cb) => cb.notNull())
      .addColumn('error_message', 'text')
      .execute()

    // Create xcm_assets table
    await db.schema
      .createTable('xcm_assets')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement().notNull())
      .addColumn('leg_id', 'integer', (cb) => cb.references('xcm_legs.id').onDelete('cascade').notNull())
      .addColumn('asset', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('symbol', 'varchar(50)', (cb) => cb.notNull())
      .addColumn('amount', 'bigint', (cb) => cb.notNull())
      .addColumn('decimals', 'integer', (cb) => cb.notNull())
      .execute()

    // Create indexes
    await db.schema
      .createIndex('xcm_journeys_created_at_index')
      .ifNotExists()
      .on('xcm_journeys')
      .column('created_at')
      .execute()

    await db.schema
      .createIndex('xcm_legs_journey_id_index')
      .ifNotExists()
      .on('xcm_legs')
      .column('journey_id')
      .execute()

    await db.schema
      .createIndex('xcm_assets_leg_id_index')
      .ifNotExists()
      .on('xcm_assets')
      .column('leg_id')
      .execute()
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('xcm_assets').execute()
  await db.schema.dropTable('xcm_legs').execute()
  await db.schema.dropTable('xcm_journeys').execute()
}
