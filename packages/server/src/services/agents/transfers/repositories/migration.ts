import { Kysely, sql } from 'kysely'

/**
 * Intra-chain transfers schema.
 *
 * This table stores asset transfers that occur entirely within a single chain.
 *
 * Design goals:
 * - Multi-chain support via `network`
 * - Fast address, asset, and tx-based lookups
 * - JSON flexibility for event + transaction payloads
 */
export async function up(db: Kysely<any>): Promise<void> {
  try {
    await db.schema
      .createTable('ic_transfers')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement().notNull())
      .addColumn('transfer_hash', 'blob', (cb) => cb.notNull().unique())
      .addColumn('type', 'text', (cb) => cb.notNull())
      .addColumn('network', 'text', (cb) => cb.notNull())
      .addColumn('block_number', 'text', (cb) => cb.notNull())
      .addColumn('block_hash', 'blob', (cb) => cb.notNull())
      .addColumn('event_index', 'integer', (cb) => cb.notNull())
      .addColumn('event_module', 'text', (cb) => cb.notNull())
      .addColumn('event_name', 'text', (cb) => cb.notNull())
      .addColumn('from', 'text', (cb) => cb.notNull())
      .addColumn('to', 'text', (cb) => cb.notNull())
      .addColumn('from_formatted', 'text')
      .addColumn('to_formatted', 'text')
      .addColumn('sent_at', 'timestamp')
      .addColumn('created_at', 'timestamp', (cb) => cb.notNull().defaultTo(sql`current_timestamp`))
      .addColumn('tx_primary', 'blob')
      .addColumn('tx_secondary', 'blob')
      .addColumn('tx_index', 'integer')
      .addColumn('tx_module', 'text')
      .addColumn('tx_method', 'text')
      .addColumn('tx_signer', 'blob')
      .addColumn('asset', 'text', (cb) => cb.notNull())
      .addColumn('symbol', 'text')
      .addColumn('amount', 'text', (cb) => cb.notNull())
      .addColumn('decimals', 'integer')
      .addColumn('usd', 'decimal')
      .execute()

    await db.schema
      .createTable('ic_asset_volume_cache')
      .ifNotExists()
      .addColumn('asset', 'text', (cb) => cb.primaryKey())
      .addColumn('symbol', 'text')
      .addColumn('usd_volume', 'real', (cb) => cb.notNull())
      .addColumn('snapshot_start', 'integer', (cb) => cb.notNull())
      .addColumn('snapshot_end', 'integer', (cb) => cb.notNull())
      .execute()

    await db.schema
      .createIndex('ic_transfers_tx_primary_index')
      .ifNotExists()
      .on('ic_transfers')
      .column('tx_primary')
      .execute()

    await db.schema
      .createIndex('ic_transfers_tx_secondary_index')
      .ifNotExists()
      .on('ic_transfers')
      .column('tx_secondary')
      .execute()

    await db.schema
      .createIndex('ic_transfers_network_index')
      .ifNotExists()
      .on('ic_transfers')
      .column('network')
      .execute()

    await db.schema
      .createIndex('ic_transfers_sent_at_id_index')
      .ifNotExists()
      .on('ic_transfers')
      .columns(['sent_at', 'id'])
      .execute()

    await db.schema
      .createIndex('ic_transfers_type_sent_at_id_index')
      .ifNotExists()
      .on('ic_transfers')
      .columns(['type', 'sent_at', 'id'])
      .execute()

    await db.schema
      .createIndex('ic_transfers_network_sent_at_id_index')
      .ifNotExists()
      .on('ic_transfers')
      .columns(['network', 'sent_at', 'id'])
      .execute()

    await db.schema
      .createIndex('ic_transfers_from_sent_at_id_index')
      .ifNotExists()
      .on('ic_transfers')
      .columns(['from', 'sent_at', 'id'])
      .execute()

    await db.schema
      .createIndex('ic_transfers_to_sent_at_id_index')
      .ifNotExists()
      .on('ic_transfers')
      .columns(['to', 'sent_at', 'id'])
      .execute()

    await db.schema
      .createIndex('ic_transfers_asset_sent_at_id_index')
      .ifNotExists()
      .on('ic_transfers')
      .columns(['asset', 'sent_at', 'id'])
      .execute()

    await db.schema
      .createIndex('ic_asset_volume_cache_snapshot_volume_index')
      .ifNotExists()
      .on('ic_asset_volume_cache')
      .columns(['snapshot_start', 'snapshot_end', 'usd_volume', 'asset'])
      .execute()
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('ic_transfers').execute()
  await db.schema.dropTable('ic_asset_volume_cache').execute()
}
