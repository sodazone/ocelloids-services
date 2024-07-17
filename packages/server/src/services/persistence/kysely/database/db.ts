import SQLite from 'better-sqlite3'

import { Kysely, SqliteDialect } from 'kysely'

import { Database } from './types.js'

let db: Kysely<Database>

interface SQLiteOptions {
  filename: string
  options?: SQLite.Options
}

export function openDatabase(opts: SQLiteOptions) {
  if (db) {
    return db
  }

  const dialect = new SqliteDialect({
    database: new SQLite(opts.filename, opts.options),
  })
  db = new Kysely<Database>({
    dialect,
  })

  return db
}
