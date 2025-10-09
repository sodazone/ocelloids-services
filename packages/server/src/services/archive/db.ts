import { createKyselyDatabase } from '../persistence/kysely/db.js'
import * as schema from './migrations/archive_schema.js'
import { Database } from './types.js'

export function createArchiveDatabase(filename: string) {
  return createKyselyDatabase<Database>({
    filename,
    migrations: {
      '0': schema,
    },
  })
}
