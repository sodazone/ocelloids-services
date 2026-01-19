import { Kysely, sql } from 'kysely'

/**
 * Crosschain journeys schema.
 *
 * A "journey" models the full cross-chain execution and flow of actions
 * (swaps, transfers, etc.) and moved assets between an origin and a
 * destination chain. A journey may involve multiple protocols internally
 * (e.g., Wormhole + XCM), which are captured in the `stops` JSON. Because
 * there is not always a clear "main protocol," we store only the edges in
 * top-level columns:
 *
 * - `origin_protocol` / `destination_protocol` describe the entry and exit
 *   protocols for efficient filtering.
 * - Intermediate hops (protocols, instructions, fees, etc.) are stored in
 *   the `stops` JSON for flexibility and rich reconstruction.
 *
 * Journeys can be connected into "trips" via `trip_id` and connection FKs.
 * Trips allow stitching multiple journeys together into a larger flow but
 * are optional and do not constrain the journey model.
 *
 * This design favors:
 * - Efficient filtering/search on common fields.
 * - Flexibility for multi-step, multi-protocol flows.
 * - A simple connection model for higher-level grouping.
 */
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
      .addColumn('origin_protocol', 'varchar(50)', (cb) => cb.notNull().defaultTo('xcm'))
      .addColumn('destination_protocol', 'varchar(50)', (cb) => cb.notNull().defaultTo('xcm'))
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
      .addColumn('destination_tx_primary', 'varchar(255)')
      .addColumn('destination_tx_secondary', 'varchar(255)')
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
      .addColumn('amount', 'text', (cb) => cb.notNull())
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
      .createIndex('xc_journeys_type_sent_at_id_index')
      .ifNotExists()
      .on('xc_journeys')
      .columns(['type', 'sent_at', 'id'])
      .execute()

    await db.schema
      .createIndex('xc_journeys_status_sent_at_id_index')
      .ifNotExists()
      .on('xc_journeys')
      .columns(['status', 'sent_at', 'id'])
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
      .createIndex('xc_journeys_origin_destination_index')
      .ifNotExists()
      .on('xc_journeys')
      .columns(['origin', 'destination'])
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
      .createIndex('xc_journeys_destination_tx_primary_index')
      .ifNotExists()
      .on('xc_journeys')
      .column('destination_tx_primary')
      .execute()

    await db.schema
      .createIndex('xc_journeys_destination_tx_secondary_index')
      .ifNotExists()
      .on('xc_journeys')
      .column('destination_tx_secondary')
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
      .createIndex('xc_journeys_origin_protocol_index')
      .ifNotExists()
      .on('xc_journeys')
      .column('origin_protocol')
      .execute()

    await db.schema
      .createIndex('xc_journeys_destination_protocol_index')
      .ifNotExists()
      .on('xc_journeys')
      .column('destination_protocol')
      .execute()

    await db.schema
      .createIndex('xc_journeys_trip_id_index')
      .ifNotExists()
      .on('xc_journeys')
      .column('trip_id')
      .execute()

    await db.schema
      .createIndex('idx_journeys_sent_status')
      .ifNotExists()
      .on('xc_journeys')
      .columns(['status', 'sent_at'])
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

    await db.schema
      .createIndex('idx_asset_ops_journey_asset')
      .ifNotExists()
      .on('xc_asset_ops')
      .columns(['journey_id', 'asset'])
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
