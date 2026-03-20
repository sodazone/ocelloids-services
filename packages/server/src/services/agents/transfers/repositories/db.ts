import { createKyselyDatabase, parseConnectionString } from '@/services/persistence/kysely/db.js'
import * as pgSchema from './schema/pg.js'
import * as sqliteSchema from './schema/sqlite.js'

import { IntrachainTransfersDatabase } from './types.js'

export function createIntrachainTransfersDatabase(connectionString: string) {
  const info = parseConnectionString(connectionString)

  if (info.dialect === 'sqlite') {
    return createKyselyDatabase<IntrachainTransfersDatabase>({
      dialect: 'sqlite',
      filename: info.filename,
      migrations: {
        '2026-01-29_create_ic_tables': sqliteSchema,
      },
    })
  } else {
    return createKyselyDatabase<IntrachainTransfersDatabase>({
      dialect: 'postgres',
      connectionString,
      migrations: {
        '2026-01-29_create_ic_tables': pgSchema,
      },
    })
  }
}
