import SQLite from 'better-sqlite3'

import { Kysely, Migration, Migrator, SqliteDialect } from 'kysely'

import * as initial from './migrations/000000_schema.js'

import { Database } from './types.js'

let _db: Kysely<Database>

interface SQLiteOptions {
  filename: string
  options?: SQLite.Options
}

export function openDatabase(opts: SQLiteOptions) {
  if (_db) {
    return _db
  }

  const dialect = new SqliteDialect({
    database: new SQLite(opts.filename, opts.options),
  })
  _db = new Kysely<Database>({
    dialect,
  })

  return _db
}

export async function migrate(db: Kysely<any>) {
  const migrator = new Migrator({
    db,
    provider: {
      getMigrations: async (): Promise<Record<string, Migration>> => {
        return {
          '000000': initial,
        }
      },
    },
  })
  return migrator.migrateToLatest()
}
