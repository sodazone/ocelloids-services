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
      .addColumn('token_deficit_usd', 'real')
      .addColumn('staking_network', 'text')
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
      .addColumn('counterparty_address', 'text')
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

    await db.schema
      .createTable('defi_price')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement())
      .addColumn('network', 'text', (cb) => cb.notNull())
      .addColumn('protocol', 'text', (cb) => cb.notNull())
      .addColumn('asset_id', 'text', (cb) => cb.notNull())
      .addColumn('symbol', 'text', (cb) => cb.notNull())
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

    await db.schema
      .createTable('defi_order')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement())
      .addColumn('network', 'text', (cb) => cb.notNull())
      .addColumn('protocol', 'text', (cb) => cb.notNull())
      .addColumn('order_id', 'text', (cb) => cb.notNull())
      .addColumn('order_key', 'text', (cb) => cb.notNull())

      .addColumn('owner', 'text', (cb) => cb.notNull())
      .addColumn('asset_in', 'text', (cb) => cb.notNull())
      .addColumn('asset_out', 'text', (cb) => cb.notNull())
      .addColumn('symbol_in', 'text', (cb) => cb.notNull())
      .addColumn('symbol_out', 'text', (cb) => cb.notNull())
      .addColumn('amount_in', 'text')
      .addColumn('amount_out', 'text')

      .addColumn('fill_count', 'integer', (cb) => cb.notNull().defaultTo(0))
      .addColumn('filled_amount_in', 'text', (cb) => cb.defaultTo('0'))
      .addColumn('filled_amount_out', 'text', (cb) => cb.defaultTo('0'))
      .addColumn('filled_amount_usd', 'text', (cb) => cb.defaultTo('0'))
      .addColumn('status', 'text', (cb) => cb.notNull())

      .addColumn('created_tx_hash', 'text')
      .addColumn('created_block_number', 'integer')
      .addColumn('created_block_hash', 'text')
      .addColumn('created_at', 'integer')
      .addColumn('updated_at_block', 'integer', (cb) => cb.notNull())
      .addColumn('updated_at', 'integer', (cb) => cb.notNull())
      .addUniqueConstraint('defi_order_unique_order_key', ['order_key'])
      .execute()

    await db.schema
      .createIndex('idx_defi_order_owner')
      .ifNotExists()
      .on('defi_order')
      .columns(['owner'])
      .execute()

    await db.schema
      .createIndex('idx_defi_order_status')
      .ifNotExists()
      .on('defi_order')
      .columns(['status'])
      .execute()

    await db.schema
      .createIndex('idx_defi_network_protocol')
      .ifNotExists()
      .on('defi_order')
      .columns(['network', 'protocol'])
      .execute()

    await db.schema
      .createIndex('idx_defi_created_at_id')
      .ifNotExists()
      .on('defi_order')
      .columns(['created_at', 'id'])
      .execute()

    await db.schema
      .createTable('defi_order_fill')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().autoIncrement())
      .addColumn('order_key', 'text', (cb) =>
        cb.references('defi_order.order_key').onDelete('cascade').notNull(),
      )
      .addColumn('filler', 'text')
      .addColumn('amount_in', 'text', (cb) => cb.notNull())
      .addColumn('amount_out', 'text', (cb) => cb.notNull())
      .addColumn('amount_usd', 'text')
      .addColumn('tx_hash', 'text')
      .addColumn('block_number', 'integer', (cb) => cb.notNull())
      .addColumn('block_hash', 'text', (cb) => cb.notNull())
      .addColumn('block_event_index', 'integer', (cb) => cb.notNull())
      .addColumn('timestamp', 'integer', (cb) => cb.notNull())
      .addUniqueConstraint('defi_order_fill_unique_order_block_event', [
        'order_key',
        'block_hash',
        'block_event_index',
      ])
      .execute()
  } catch (error) {
    console.error('SQLite Migration failed:', error)
    throw error
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('defi_pool_asset').execute()
  await db.schema.dropTable('defi_pool').execute()
  await db.schema.dropTable('defi_price').execute()
  await db.schema.dropTable('defi_event_asset').execute()
  await db.schema.dropTable('defi_event').execute()
  await db.schema.dropTable('defi_order').execute()
  await db.schema.dropTable('defi_order_fill').execute()
}
