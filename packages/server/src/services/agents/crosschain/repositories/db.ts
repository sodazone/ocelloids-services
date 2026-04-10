import { createKyselyDatabase, parseConnectionString } from '@/services/persistence/kysely/db.js'
import * as pgSchema from './schema/pg.js'
import * as sqliteSchema from './schema/sqlite.js'
import { CrosschainDatabase } from './types.js'

export function createCrosschainDatabase(connectionString: string) {
  const info = parseConnectionString(connectionString)

  if (info.dialect === 'sqlite') {
    return createKyselyDatabase<CrosschainDatabase>({
      dialect: 'sqlite',
      filename: info.filename,
      migrations: {
        '2025-09-22_create_xc_tables': sqliteSchema,
      },
    })
  } else {
    return createKyselyDatabase<CrosschainDatabase>({
      dialect: 'postgres',
      connectionString,
      migrations: {
        '2025-09-22_create_xc_tables': pgSchema,
      },
    })
  }
}
