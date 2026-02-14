import { createKyselyDatabase } from '@/services/persistence/kysely/db.js'
import * as schema from './migration.js'
import { IntrachainTransfersDatabase } from './types.js'

export function createIntrachainTransfersDatabase(filename: string) {
  return createKyselyDatabase<IntrachainTransfersDatabase>({
    filename,
    migrations: {
      '2026-01-29_create_ic_tables': schema,
    },
  })
}
