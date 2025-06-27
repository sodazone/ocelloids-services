import { createKyselyDatabase } from '@/services/persistence/kysely/db.js'
import * as schema from './migration.js'
import { XcmDatabase } from './types.js'

export function createXcmDatabase(filename: string) {
  return createKyselyDatabase<XcmDatabase>({
    filename,
    migrations: {
      '0': schema,
    },
  })
}
