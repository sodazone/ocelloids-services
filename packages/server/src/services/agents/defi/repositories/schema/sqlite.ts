import { Kysely } from 'kysely'

/**
 * DeFi schema for SQLite.
 */
export async function up(db: Kysely<any>): Promise<void> {
  try {
    await db.schema
      .createTable('defi_pool')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement())
      .addColumn('category', 'text', (cb) => cb.notNull())
      .addColumn('protocol', 'text', (cb) => cb.notNull())
      .addColumn('network', 'text', (cb) => cb.notNull())
      .addColumn('market_id', 'text', (cb) => cb.notNull())
      .addColumn('borrow_apr', 'real')
      .addColumn('supply_apr', 'real')
      .addColumn('is_paused', 'integer')
      .addColumn('can_borrow', 'integer')
      .addColumn('borrow_cap', 'text')
      .addColumn('supply_cap', 'text')
      .addColumn('bad_debt_usd', 'real')
      .addUniqueConstraint('defi_pool_network_protocol_market_unique', ['network', 'protocol', 'market_id'])
      .execute()

    await db.schema
      .createTable('defi_pool_asset')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement())
      .addColumn('pool_id', 'integer', (cb) => cb.references('defi_pool.id').onDelete('cascade').notNull())
      .addColumn('asset_id', 'text', (cb) => cb.notNull())
      .addColumn('symbol', 'text', (cb) => cb.notNull())
      .addColumn('decimals', 'integer', (cb) => cb.notNull())
      .addColumn('balance_total', 'text')
      .addColumn('balance_available', 'text')
      .addColumn('balance_borrowed', 'text')
      .addColumn('reserves', 'text', (cb) => cb.notNull())
      .addColumn('price_usd', 'text')
      .addColumn('role', 'text')
      .addUniqueConstraint('defi_pool_asset_pool_asset_unique', ['pool_id', 'asset_id'])
      .execute()

    await db.schema
      .createIndex('idx_defi_pool_lookup')
      .ifNotExists()
      .on('defi_pool')
      .columns(['network', 'protocol'])
      .execute()

    await db.schema
      .createIndex('idx_defi_pool_asset_pool_id')
      .ifNotExists()
      .on('defi_pool_asset')
      .column('pool_id')
      .execute()

    await db.schema
      .createTable('defi_event')
      .ifNotExists()
      .addColumn('id', 'text', (cb) => cb.primaryKey())
      .addColumn('pool_id', 'integer', (cb) => cb.references('defi_pool.id').onDelete('set null'))
      .addColumn('network_id', 'text', (cb) => cb.notNull())
      .addColumn('protocol', 'text', (cb) => cb.notNull())
      .addColumn('market_id', 'text', (cb) => cb.notNull())
      .addColumn('block_number', 'integer')
      .addColumn('block_hash', 'text')
      .addColumn('tx_hash', 'text')
      .addColumn('event_name', 'text', (cb) => cb.notNull())
      .addColumn('actor_address', 'text', (cb) => cb.notNull())
      .addColumn('counterparty_address', 'varchar(255)')
      .addColumn('status', 'varchar(100)')
      .execute()

    await db.schema
      .createTable('defi_event_asset')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement())
      .addColumn('event_id', 'text', (cb) => cb.references('defi_event.id').onDelete('cascade').notNull())
      .addColumn('asset_id', 'text', (cb) => cb.notNull())
      .addColumn('symbol', 'text', (cb) => cb.notNull())
      .addColumn('amount', 'text', (cb) => cb.notNull())
      .addColumn('amount_usd', 'text')
      .addColumn('role', 'text', (cb) => cb.notNull())
      .execute()
  } catch (error) {
    console.error('SQLite Migration failed:', error)
    throw error
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('defi_pool_asset').execute()
  await db.schema.dropTable('defi_pool').execute()
}
