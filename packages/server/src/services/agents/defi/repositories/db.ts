import { createKyselyDatabase, parseConnectionString } from '@/services/persistence/kysely/db.js'
import * as pgSchema from './schema/pg.js'
import * as sqliteSchema from './schema/sqlite.js'

import { DefiDatabase } from './types.js'

export function createDefiDatabase(connectionString: string) {
  const info = parseConnectionString(connectionString)

  if (info.dialect === 'sqlite') {
    return createKyselyDatabase<DefiDatabase>({
      dialect: 'sqlite',
      filename: info.filename,
      migrations: {
        '2026-04-22_create_defi_tables': sqliteSchema,
      },
    })
  } else {
    return createKyselyDatabase<DefiDatabase>({
      dialect: 'postgres',
      connectionString,
      migrations: {
        '2026-04-22_create_defi_tables': pgSchema,
      },
      migrationTableName: 'kysely_migration_defi',
      migrationLockTableName: 'kysely_migration_lock_defi',
    })
  }
}
