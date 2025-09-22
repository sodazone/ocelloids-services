import { Kysely, sql } from 'kysely'

// ============================================================
// TEMPORARY MIGRATION
// ============================================================
// !!! ONLY RUN ONCE AND DELETE AFTER MIGRATION
// This migration rebuilds the crosschain journey tables and copies
// existing data from the old tables. It is intended for one-time use.
// ============================================================

export async function up(db: Kysely<any>): Promise<void> {
  console.log('=== START TEMPORARY MIGRATION: Rebuild xc tables ===')

  // -------------------------------
  // 1. Create xc_journeys table
  // -------------------------------
  console.log('Creating table: xc_journeys')
  await db.schema
    .createTable('xc_journeys')
    .ifNotExists()
    .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement().notNull())
    .addColumn('correlation_id', 'varchar(255)', (cb) => cb.notNull().unique())
    .addColumn('status', 'varchar(50)', (cb) => cb.notNull())
    .addColumn('type', 'varchar(50)', (cb) => cb.notNull())
    .addColumn('protocol', 'varchar(50)', (cb) => cb.notNull().defaultTo('xcm'))
    .addColumn('trip_id', 'varchar(255)')
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
    .addColumn('origin_tx_primary', 'varchar(255)')
    .addColumn('origin_tx_secondary', 'varchar(255)')
    .addColumn('in_connection_fk', 'integer', (cb) => cb.references('xc_journeys.id').onDelete('set null'))
    .addColumn('in_connection_data', 'json')
    .addColumn('out_connection_fk', 'integer', (cb) => cb.references('xc_journeys.id').onDelete('set null'))
    .addColumn('out_connection_data', 'json')
    .execute()

  console.log('Table xc_journeys created')

  // -------------------------------
  // 2. Create xc_asset_ops table
  // -------------------------------
  console.log('Creating table: xc_asset_ops')
  await db.schema
    .createTable('xc_asset_ops')
    .ifNotExists()
    .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement().notNull())
    .addColumn('journey_id', 'integer', (cb) => cb.references('xc_journeys.id').onDelete('cascade').notNull())
    .addColumn('asset', 'varchar(255)', (cb) => cb.notNull())
    .addColumn('symbol', 'varchar(50)')
    .addColumn('amount', 'bigint', (cb) => cb.notNull())
    .addColumn('decimals', 'integer')
    .addColumn('usd', 'decimal')
    .addColumn('role', 'varchar(20)')
    .addColumn('sequence', 'integer')
    .execute()
  console.log('Table xc_asset_ops created')

  // -------------------------------
  // 3. Create xc_asset_volume_cache table
  // -------------------------------
  console.log('Creating table: xc_asset_volume_cache')
  await db.schema
    .createTable('xc_asset_volume_cache')
    .ifNotExists()
    .addColumn('asset', 'varchar(255)', (col) => col.primaryKey().notNull())
    .addColumn('symbol', 'varchar(50)')
    .addColumn('usd_volume', 'decimal', (col) => col.notNull().defaultTo('0'))
    .addColumn('snapshot_start', 'timestamp', (col) => col.notNull())
    .addColumn('snapshot_end', 'timestamp', (col) => col.notNull())
    .execute()
  console.log('Table xc_asset_volume_cache created')

  // -------------------------------
  // 4. Copy data from old tables if they exist
  // -------------------------------
  const hasOldJourneys = await db
    .selectFrom('sqlite_master')
    .select('name')
    .where('type', '=', 'table')
    .where('name', '=', 'xcm_journeys')
    .executeTakeFirst()

  if (hasOldJourneys) {
    console.log('Old tables detected. Copying data...')
    await db.executeQuery(
      sql`
        INSERT INTO xc_journeys (
          id, correlation_id, status, type, protocol, origin, destination,
          "from", "to", from_formatted, to_formatted,
          sent_at, recv_at, created_at,
          stops, instructions, transact_calls,
          origin_tx_primary, origin_tx_secondary
        )
        SELECT
          id, correlation_id, status, type, 'xcm', origin, destination,
          "from", "to", from_formatted, to_formatted,
          sent_at, recv_at, created_at,
          stops, instructions, transact_calls,
          origin_extrinsic_hash, origin_evm_tx_hash
        FROM xcm_journeys
      `.compile(db),
    )

    await db.executeQuery(
      sql`
        INSERT INTO xc_asset_ops (
          id, journey_id, asset, symbol, amount, decimals, usd, role, sequence
        )
        SELECT id, journey_id, asset, symbol, amount, decimals, usd, role, sequence
        FROM xcm_assets
      `.compile(db),
    )

    await db.executeQuery(
      sql`
        INSERT INTO xc_asset_volume_cache (
          asset, symbol, usd_volume, snapshot_start, snapshot_end
        )
        SELECT asset, symbol, usd_volume, snapshot_start, snapshot_end
        FROM xcm_asset_volume_cache
      `.compile(db),
    )

    // Drop old tables
    await db.schema.dropTable('xcm_assets').ifExists().execute()
    await db.schema.dropTable('xcm_journeys').ifExists().execute()
    await db.schema.dropTable('xcm_asset_volume_cache').ifExists().execute()

    console.log('Old data copied and old tables dropped')
  } else {
    console.log('No old tables found, skipping data copy')
  }

  // -------------------------------
  // 5. Create indexes
  // -------------------------------
  console.log('Creating indexes for new tables')
  const indexes = [
    { table: 'xc_journeys', columns: ['sent_at'], name: 'xc_journeys_sent_at_index' },
    { table: 'xc_journeys', columns: ['origin'], name: 'xc_journeys_origin_index' },
    { table: 'xc_journeys', columns: ['destination'], name: 'xc_journeys_destination_index' },
    { table: 'xc_journeys', columns: ['origin_tx_primary'], name: 'xc_journeys_origin_tx_primary_index' },
    { table: 'xc_journeys', columns: ['origin_tx_secondary'], name: 'xc_journeys_origin_tx_secondary_index' },
    { table: 'xc_journeys', columns: ['type'], name: 'xc_journeys_type_index' },
    { table: 'xc_journeys', columns: ['status'], name: 'xc_journeys_status_index' },
    { table: 'xc_journeys', columns: ['origin', 'from'], name: 'xc_journeys_origin_from_index' },
    { table: 'xc_journeys', columns: ['destination', 'to'], name: 'xc_journeys_destination_to_index' },
    { table: 'xc_journeys', columns: ['from', 'to'], name: 'xc_journeys_from_to_index' },
    { table: 'xc_journeys', columns: ['protocol'], name: 'xc_journeys_protocol_index' },
    { table: 'xc_journeys', columns: ['trip_id'], name: 'xc_journeys_trip_id_index' },
    { table: 'xc_asset_ops', columns: ['journey_id'], name: 'xc_assets_journey_id_index' },
    { table: 'xc_asset_ops', columns: ['asset'], name: 'xc_assets_asset_index' },
    { table: 'xc_asset_ops', columns: ['symbol'], name: 'xc_assets_symbol_index' },
    { table: 'xc_asset_ops', columns: ['journey_id', 'usd'], name: 'xc_assets_journey_usd_index' },
    { table: 'xc_asset_ops', columns: ['usd'], name: 'xc_assets_usd_index' },
    { table: 'xc_asset_ops', columns: ['asset', 'symbol'], name: 'xc_assets_asset_symbol_index' },
    {
      table: 'xc_asset_volume_cache',
      columns: ['snapshot_start', 'usd_volume', 'asset'],
      name: 'xc_asset_volume_cache_snapshot_volume_index',
    },
  ]

  for (const idx of indexes) {
    await db.schema.createIndex(idx.name).ifNotExists().on(idx.table).columns(idx.columns).execute()
  }

  console.log('Indexes created')
  console.log('=== TEMPORARY MIGRATION COMPLETE ===')
}

/**
 * Crosschain journeys schema.
 *
 * We model multi-protocol journeys using a linear connection approach: each row in xc_journeys represents
 * a single protocol-specific journey, and optional in_connection_fk / out_connection_fk fields
 * point to the previous and next journeys in the trip. Connection metadata can be stored in
 * JSON fields (in_connection_data / out_connection_data).
 * This keeps the schema simple and search-efficient, while allowing full multi-step trips to be reconstructed in the details view.
 * It also avoids modifying existing queries or adding complex graph structures.
 */
export async function _up(db: Kysely<any>): Promise<void> {
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
      .addColumn('trip_id', 'varchar(255)') // shared id for multi-protocol trips (nullable)
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
      // For example, Polkadot could have the extrinc hash and the evm tx hash
      .addColumn('origin_tx_primary', 'varchar(255)')
      .addColumn('origin_tx_secondary', 'varchar(255)')
      // Optional linear connections between journeys
      .addColumn('in_connection_fk', 'integer', (cb) => cb.references('xc_journeys.id').onDelete('set null'))
      .addColumn('in_connection_data', 'json')
      .addColumn('out_connection_fk', 'integer', (cb) => cb.references('xc_journeys.id').onDelete('set null'))
      .addColumn('out_connection_data', 'json')
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
      .createIndex('xc_journeys_origin_tx_primary_index')
      .ifNotExists()
      .on('xc_journeys')
      .column('origin_tx_primary')
      .execute()

    await db.schema
      .createIndex('xc_journeys_origin_tx_secondary_index')
      .ifNotExists()
      .on('xc_journeys')
      .column('origin_tx_secondary')
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
      .createIndex('xc_journeys_trip_id_index')
      .ifNotExists()
      .on('xc_journeys')
      .column('trip_id')
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
