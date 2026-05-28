import { Kysely } from 'kysely'

/**
 * DeFi schema for PostgreSQL.
 */
export async function up(db: Kysely<any>): Promise<void> {
  try {
    await db.schema
      .createTable('defi_pool')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().generatedByDefaultAsIdentity())
      .addColumn('category', 'varchar(100)', (cb) => cb.notNull())
      .addColumn('protocol', 'varchar(100)', (cb) => cb.notNull())
      .addColumn('network', 'varchar(100)', (cb) => cb.notNull())
      .addColumn('market_id', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('borrow_apr', 'numeric')
      .addColumn('supply_apr', 'numeric')
      .addColumn('is_paused', 'boolean')
      .addColumn('can_borrow', 'boolean')
      .addColumn('borrow_cap', 'varchar(255)')
      .addColumn('supply_cap', 'varchar(255)')
      .addColumn('token_deficit_usd', 'numeric')
      .addUniqueConstraint('defi_pool_network_protocol_market_unique', ['network', 'protocol', 'market_id'])
      .execute()

    await db.schema
      .createTable('defi_pool_asset')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().generatedByDefaultAsIdentity())
      .addColumn('pool_id', 'integer', (cb) => cb.references('defi_pool.id').onDelete('cascade').notNull())
      .addColumn('asset_id', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('symbol', 'varchar(50)', (cb) => cb.notNull())
      .addColumn('decimals', 'integer', (cb) => cb.notNull())
      .addColumn('balance_total', 'text')
      .addColumn('balance_available', 'text')
      .addColumn('balance_borrowed', 'text')
      .addColumn('reserves', 'text', (cb) => cb.notNull())
      .addColumn('price_usd', 'text')
      .addColumn('role', 'varchar(50)')
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
      .addColumn('id', 'varchar(26)', (cb) => cb.primaryKey())
      .addColumn('pool_id', 'integer', (cb) => cb.references('defi_pool.id').onDelete('set null'))
      .addColumn('network_id', 'varchar(100)', (cb) => cb.notNull())
      .addColumn('protocol', 'varchar(100)', (cb) => cb.notNull())
      .addColumn('market_id', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('block_number', 'bigint')
      .addColumn('block_hash', 'varchar(66)')
      .addColumn('tx_hash', 'varchar(66)')
      .addColumn('event_name', 'varchar(20)', (cb) => cb.notNull())
      .addColumn('actor_address', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('counterparty_address', 'varchar(255)')
      .addColumn('status', 'varchar(100)')
      .execute()

    await db.schema
      .createTable('defi_event_asset')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().generatedByDefaultAsIdentity())
      .addColumn('event_id', 'varchar(26)', (cb) =>
        cb.references('defi_event.id').onDelete('cascade').notNull(),
      )
      .addColumn('asset_id', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('symbol', 'varchar(50)', (cb) => cb.notNull())
      .addColumn('amount', 'text', (cb) => cb.notNull())
      .addColumn('amount_usd', 'text')
      .addColumn('role', 'varchar(10)', (cb) => cb.notNull())
      .execute()

    await db.schema
      .createTable('defi_price')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().generatedByDefaultAsIdentity())
      .addColumn('network', 'varchar(100)', (cb) => cb.notNull())
      .addColumn('protocol', 'varchar(100)', (cb) => cb.notNull())
      .addColumn('asset_id', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('symbol', 'varchar(50)', (cb) => cb.notNull())
      .addColumn('decimals', 'integer', (cb) => cb.notNull())
      .addColumn('price_usd', 'text', (cb) => cb.notNull())
      .addColumn('updated_at', 'integer', (cb) => cb.notNull())
      .addUniqueConstraint('token_price_network_protocol_asset_unique', ['network', 'protocol', 'asset_id'])
      .execute()

    await db.schema
      .createIndex('idx_defi_price_lookup')
      .ifNotExists()
      .on('defi_price')
      .columns(['network', 'asset_id'])
      .execute()

    await db.schema
      .createIndex('idx_defi_price_protocol_lookup')
      .ifNotExists()
      .on('defi_price')
      .columns(['network', 'protocol'])
      .execute()
  } catch (error) {
    console.error('PostgreSQL Migration failed:', error)
    throw error
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('defi_pool_asset').execute()
  await db.schema.dropTable('defi_pool').execute()
  await db.schema.dropTable('defi_price').execute()
}
