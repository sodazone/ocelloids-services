import * as schema from './migrations/system_schema.js'

import { createKyselyDatabase } from '../persistence/kysely/db.js'
import { Database } from './types.js'

export function createSystemDatabase(filename: string) {
  return createKyselyDatabase<Database>({
    filename,
    migrations: {
      '0': schema,
    },
  })
}
