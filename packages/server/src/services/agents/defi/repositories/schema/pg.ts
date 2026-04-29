import { Kysely, sql } from 'kysely'

/**
 * DeFi DEX pools schema.
 */
export async function up(db: Kysely<any>): Promise<void> {
  try {
    await db.schema
      .createTable('defi_dex_pool')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().generatedByDefaultAsIdentity())
      .addColumn('protocol', 'varchar(100)', (cb) => cb.notNull())
      .addColumn('network', 'varchar(100)', (cb) => cb.notNull())
      .addColumn('address', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('type', 'varchar(100)', (cb) => cb.notNull())
      .execute()

    await db.schema
      .createTable('defi_dex_pool_reserve')
      .ifNotExists()
      .addColumn('id', 'integer', (cb) => cb.primaryKey().generatedByDefaultAsIdentity())
      .addColumn('pool_id', 'integer', (cb) =>
        cb.references('defi_dex_pool.id').onDelete('cascade').notNull(),
      )
      .addColumn('block_number', 'bigint', (col) => col.notNull())
      .addColumn('block_timestamp', 'bigint', (col) => col.notNull())
      .addColumn('asset_id', 'varchar(255)', (cb) => cb.notNull())
      .addColumn('symbol', 'varchar(50)')
      .addColumn('decimals', 'integer')
      .addColumn('balance', 'text', (cb) => cb.notNull())
      .addColumn('usd_value', 'decimal')
      .addColumn('weight', 'decimal')
      .addUniqueConstraint('defi_dex_pool_reserve_pool_asset_unique', ['pool_id', 'asset_id'])
      .execute()

    await db.schema
      .createIndex('defi_dex_pool_protocol_index')
      .ifNotExists()
      .on('defi_dex_pool')
      .column('protocol')
      .execute()

    await db.schema
      .createIndex('defi_dex_pool_network_index')
      .ifNotExists()
      .on('defi_dex_pool')
      .column('network')
      .execute()

    await db.schema
      .createIndex('defi_dex_pool_type_index')
      .ifNotExists()
      .on('defi_dex_pool')
      .column('type')
      .execute()

    await db.schema
      .createIndex('defi_dex_pool_network_protocol_index')
      .ifNotExists()
      .on('defi_dex_pool')
      .columns(['network', 'protocol'])
      .execute()

    await db.schema
      .createIndex('defi_dex_pool_network_address_unique')
      .ifNotExists()
      .on('defi_dex_pool')
      .columns(['network', 'address'])
      .unique()
      .execute()

    await db.schema
      .createIndex('defi_dex_pool_network_protocol_address_unique')
      .ifNotExists()
      .on('defi_dex_pool')
      .columns(['network', 'protocol', 'address'])
      .unique()
      .execute()

    await db.schema
      .createIndex('defi_dex_pool_reserve_pool_id_index')
      .ifNotExists()
      .on('defi_dex_pool_reserve')
      .column('pool_id')
      .execute()

    await db.schema
      .createIndex('defi_dex_pool_reserve_asset_id_index')
      .ifNotExists()
      .on('defi_dex_pool_reserve')
      .column('asset_id')
      .execute()

    await db.schema
      .createIndex('defi_dex_pool_reserve_symbol_index')
      .ifNotExists()
      .on('defi_dex_pool_reserve')
      .column('symbol')
      .execute()

    await db.schema
      .createIndex('defi_dex_pool_reserve_pool_token_unique')
      .ifNotExists()
      .on('defi_dex_pool_reserve')
      .columns(['pool_id', 'asset_id'])
      .unique()
      .execute()

    await sql`
      CREATE INDEX IF NOT EXISTS defi_dex_pool_reserve_pool_usd_value_index
      ON defi_dex_pool_reserve (pool_id, usd_value DESC, id DESC)
    `.execute(db)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('defi_dex_pool_reserve').execute()
  await db.schema.dropTable('defi_dex_pool').execute()
}
