import { createKyselyDatabase } from '@/services/persistence/kysely/db.js'
import * as schema from './migration.js'
import { CrosschainDatabase } from './types.js'

export function createCrosschainDatabase(filename: string) {
  return createKyselyDatabase<CrosschainDatabase>({
    filename,
    migrations: {
      '2025-09-22_create_xc_tables': schema,
    },
  })
}
