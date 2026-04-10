import { createKyselyDatabase } from '../persistence/kysely/db.js'
import * as schema from './migrations/system_schema.js'
import { Database } from './types.js'

export function createSystemDatabase(filename: string) {
  return createKyselyDatabase<Database>({
    dialect: 'sqlite',
    filename,
    migrations: {
      '0': schema,
    },
  })
}
