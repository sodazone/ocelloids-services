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
      .addColumn('network', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('block_number', 'varchar(50)', (cb) => cb.notNull())
      .addColumn('block_hash', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('event_index', 'integer', (cb) => cb.notNull())
      .addColumn('from', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('to', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('from_formatted', 'varchar(255)')
      .addColumn('to_formatted', 'varchar(255)')
      .addColumn('sent_at', 'timestamp')
      .addColumn('created_at', 'timestamp', (cb) => cb.notNull().defaultTo(sql`current_timestamp`))
      .addColumn('event', 'json', (cb) => cb.notNull())
      .addColumn('transaction', 'json', (cb) => cb.notNull())
      .addColumn('tx_primary', 'varchar(255)')
      .addColumn('tx_secondary', 'varchar(255)')
      .addColumn('asset', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('symbol', 'varchar(50)')
      .addColumn('amount', 'text', (cb) => cb.notNull())
      .addColumn('decimals', 'integer')
      .addColumn('usd', 'decimal')
      .execute()

    await db.schema
      .createIndex('ic_transfers_from_index')
      .ifNotExists()
      .on('ic_transfers')
      .column('from')
      .execute()

    await db.schema
      .createIndex('ic_transfers_to_index')
      .ifNotExists()
      .on('ic_transfers')
      .column('to')
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
      .createIndex('ic_transfers_asset_index')
      .ifNotExists()
      .on('ic_transfers')
      .column('asset')
      .execute()

    await db.schema
      .createIndex('ic_transfers_asset_usd_index')
      .ifNotExists()
      .on('ic_transfers')
      .columns(['asset', 'usd'])
      .execute()

    await db.schema
      .createIndex('ic_transfers_sent_at_index')
      .ifNotExists()
      .on('ic_transfers')
      .column('sent_at')
      .execute()

    await db.schema
      .createIndex('ic_transfers_sent_at_id_index')
      .ifNotExists()
      .on('ic_transfers')
      .columns(['sent_at', 'id'])
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
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('ic_transfers').execute()
}
