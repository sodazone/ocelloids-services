import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  try {
    // Create crosschain journeys table
    await db.schema
      .createTable('xc_journeys')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement().notNull())
      .addColumn('correlation_id', 'varchar(255)', (cb) => cb.notNull().unique())
      .addColumn('status', 'varchar(50)', (cb) => cb.notNull())
      .addColumn('type', 'varchar(50)', (cb) => cb.notNull()) // 'transfer', 'swap', &c.
      .addColumn('protocol', 'varchar(50)', (cb) => cb.notNull().defaultTo('xcm'))
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
      // TODO: maybe rename to transaction ref and tx hash?
      .addColumn('origin_extrinsic_hash', 'varchar(255)')
      .addColumn('origin_evm_tx_hash', 'varchar(255)')
      .execute()

    // Create asset operations table
    await db.schema
      .createTable('xc_asset_ops')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement().notNull())
      .addColumn('journey_id', 'integer', (cb) =>
        cb.references('xc_journeys.id').onDelete('cascade').notNull(),
      )
      .addColumn('asset', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('symbol', 'varchar(50)')
      .addColumn('amount', 'bigint', (cb) => cb.notNull())
      .addColumn('decimals', 'integer')
      .addColumn('usd', 'decimal')
      .addColumn('role', 'varchar(20)')
      .addColumn('sequence', 'integer')
      .execute()

    await db.schema
      .createTable('xc_asset_volume_cache')
      .ifNotExists()
      .addColumn('asset', 'varchar(255)', (col) => col.primaryKey().notNull())
      .addColumn('symbol', 'varchar(50)')
      .addColumn('usd_volume', 'decimal', (col) => col.notNull().defaultTo('0'))
      .addColumn('snapshot_start', 'timestamp', (col) => col.notNull())
      .addColumn('snapshot_end', 'timestamp', (col) => col.notNull())
      .execute()

    // Create indexes
    await db.schema
      .createIndex('xc_journeys_sent_at_index')
      .ifNotExists()
      .on('xc_journeys')
      .column('sent_at')
      .execute()

    await db.schema
      .createIndex('xc_journeys_origin_index')
      .ifNotExists()
      .on('xc_journeys')
      .column('origin')
      .execute()

    await db.schema
      .createIndex('xc_journeys_destination_index')
      .ifNotExists()
      .on('xc_journeys')
      .column('destination')
      .execute()

    await db.schema
      .createIndex('xc_journeys_origin_extrinsic_hash_index')
      .ifNotExists()
      .on('xc_journeys')
      .column('origin_extrinsic_hash')
      .execute()

    await db.schema
      .createIndex('xc_journeys_origin_evm_tx_hash_index')
      .ifNotExists()
      .on('xc_journeys')
      .column('origin_evm_tx_hash')
      .execute()

    await db.schema
      .createIndex('xc_journeys_type_index')
      .ifNotExists()
      .on('xc_journeys')
      .column('type')
      .execute()

    await db.schema
      .createIndex('xc_journeys_status_index')
      .ifNotExists()
      .on('xc_journeys')
      .column('status')
      .execute()

    await db.schema
      .createIndex('xc_journeys_origin_from_index')
      .ifNotExists()
      .on('xc_journeys')
      .columns(['origin', 'from'])
      .execute()

    await db.schema
      .createIndex('xc_journeys_destination_to_index')
      .ifNotExists()
      .on('xc_journeys')
      .columns(['destination', 'to'])
      .execute()

    await db.schema
      .createIndex('xc_journeys_from_to_index')
      .ifNotExists()
      .on('xc_journeys')
      .columns(['from', 'to'])
      .execute()

    await db.schema
      .createIndex('xc_journeys_protocol_index')
      .ifNotExists()
      .on('xc_journeys')
      .column('protocol')
      .execute()

    await db.schema
      .createIndex('xc_assets_journey_id_index')
      .ifNotExists()
      .on('xc_asset_ops')
      .column('journey_id')
      .execute()

    await db.schema
      .createIndex('xc_assets_asset_index')
      .ifNotExists()
      .on('xc_asset_ops')
      .column('asset')
      .execute()

    await db.schema
      .createIndex('xc_assets_symbol_index')
      .ifNotExists()
      .on('xc_asset_ops')
      .column('symbol')
      .execute()

    await db.schema
      .createIndex('xc_assets_journey_usd_index')
      .ifNotExists()
      .on('xc_asset_ops')
      .columns(['journey_id', 'usd'])
      .execute()

    await db.schema
      .createIndex('xc_assets_usd_index')
      .ifNotExists()
      .on('xc_asset_ops')
      .column('usd')
      .execute()

    await db.schema
      .createIndex('xc_assets_asset_symbol_index')
      .ifNotExists()
      .on('xc_asset_ops')
      .columns(['asset', 'symbol'])
      .execute()

    await db.schema
      .createIndex('xc_asset_volume_cache_snapshot_volume_index')
      .ifNotExists()
      .on('xc_asset_volume_cache')
      .columns(['snapshot_start', 'usd_volume', 'asset'])
      .execute()
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('xc_asset_ops').execute()
  await db.schema.dropTable('xc_journeys').execute()
  await db.schema.dropTable('xc_asset_volume_cache').execute()
}
