import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  try {
    // Create xcm_journeys table
    await db.schema
      .createTable('xcm_journeys')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement().notNull())
      .addColumn('correlation_id', 'varchar(255)', (cb) => cb.notNull().unique())
      .addColumn('status', 'varchar(50)', (cb) => cb.notNull())
      .addColumn('type', 'varchar(50)', (cb) => cb.notNull())
      .addColumn('origin', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('destination', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('from', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('to', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('from_formatted', 'varchar(255)')
      .addColumn('to_formatted', 'varchar(255)')
      .addColumn('sent_at', 'timestamp')
      .addColumn('recv_at', 'timestamp')
      .addColumn('created_at', 'timestamp', (cb) => cb.notNull().defaultTo(sql`current_timestamp`))
      .addColumn('stops', 'json', (cb) => cb.notNull())
      .addColumn('instructions', 'json', (cb) => cb.notNull())
      .addColumn('transact_calls', 'json', (cb) => cb.notNull())
      .addColumn('origin_extrinsic_hash', 'varchar(255)')
      .addColumn('origin_evm_tx_hash', 'varchar(255)')
      .execute()

    // Create xcm_assets table
    await db.schema
      .createTable('xcm_assets')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement().notNull())
      .addColumn('journey_id', 'integer', (cb) =>
        cb.references('xcm_journeys.id').onDelete('cascade').notNull(),
      )
      .addColumn('asset', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('symbol', 'varchar(50)')
      .addColumn('amount', 'bigint', (cb) => cb.notNull())
      .addColumn('decimals', 'integer')
      .addColumn('usd', 'decimal')
      .addColumn('role', 'varchar(20)')
      .addColumn('sequence', 'integer')
      .execute()

    // Create indexes
    await db.schema
      .createIndex('xcm_journeys_sent_at_index')
      .ifNotExists()
      .on('xcm_journeys')
      .column('sent_at')
      .execute()

    await db.schema
      .createIndex('xcm_journeys_origin_index')
      .ifNotExists()
      .on('xcm_journeys')
      .column('origin')
      .execute()

    await db.schema
      .createIndex('xcm_journeys_destination_index')
      .ifNotExists()
      .on('xcm_journeys')
      .column('destination')
      .execute()

    await db.schema
      .createIndex('xcm_journeys_origin_extrinsic_hash_index')
      .ifNotExists()
      .on('xcm_journeys')
      .column('origin_extrinsic_hash')
      .execute()

    await db.schema
      .createIndex('xcm_journeys_origin_evm_tx_hash_index')
      .ifNotExists()
      .on('xcm_journeys')
      .column('origin_evm_tx_hash')
      .execute()

    await db.schema
      .createIndex('xcm_journeys_type_index')
      .ifNotExists()
      .on('xcm_journeys')
      .column('type')
      .execute()

    await db.schema
      .createIndex('xcm_journeys_status_index')
      .ifNotExists()
      .on('xcm_journeys')
      .column('status')
      .execute()

    await db.schema
      .createIndex('xcm_journeys_origin_from_index')
      .ifNotExists()
      .on('xcm_journeys')
      .columns(['origin', 'from'])
      .execute()

    await db.schema
      .createIndex('xcm_journeys_destination_to_index')
      .ifNotExists()
      .on('xcm_journeys')
      .columns(['destination', 'to'])
      .execute()

    await db.schema
      .createIndex('xcm_journeys_from_to_index')
      .ifNotExists()
      .on('xcm_journeys')
      .columns(['from', 'to'])
      .execute()

    await db.schema
      .createIndex('xcm_assets_journey_id_index')
      .ifNotExists()
      .on('xcm_assets')
      .column('journey_id')
      .execute()

    await db.schema
      .createIndex('xcm_assets_asset_index')
      .ifNotExists()
      .on('xcm_assets')
      .column('asset')
      .execute()

    await db.schema
      .createIndex('xcm_assets_journey_usd_index')
      .ifNotExists()
      .on('xcm_assets')
      .columns(['journey_id', 'usd'])
      .execute()

    await db.schema.createIndex('xcm_assets_usd_index').ifNotExists().on('xcm_assets').column('usd').execute()

    await db.schema
      .createIndex('xcm_assets_asset_symbol_index')
      .ifNotExists()
      .on('xcm_assets')
      .columns(['asset', 'symbol'])
      .execute()
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('xcm_assets').execute()
  await db.schema.dropTable('xcm_journeys').execute()
}
