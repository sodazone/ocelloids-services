import { createKyselyDatabase, parseConnectionString } from '@/services/persistence/kysely/db.js'
import * as pgSchema from './schema/pg.js'

import { DefiDatabase } from './types.js'

export function createIntrachainTransfersDatabase(connectionString: string) {
  const info = parseConnectionString(connectionString)

  if (info.dialect === 'sqlite') {
    throw new Error('SQLite is not supported')
  } else {
    return createKyselyDatabase<DefiDatabase>({
      dialect: 'postgres',
      connectionString,
      migrations: {
        '2026-04-22_create_defi_tables': pgSchema,
      },
    })
  }
}
