import SQLite from 'better-sqlite3'
import { Kysely, Migration, Migrator, SqliteDialect } from 'kysely'

export interface SQLiteOptions {
  filename: string
  migrations: Record<string, Migration>
  options?: SQLite.Options
}

export function createKyselyDatabase<T>(opts: SQLiteOptions) {
  const sqliteDb = new SQLite(opts.filename, opts.options)

  sqliteDb.pragma('journal_mode = WAL')
  sqliteDb.pragma('cache_size = 10000') // ~40 MB page cache
  sqliteDb.pragma('synchronous = NORMAL')
  sqliteDb.pragma('temp_store = MEMORY')

  const dialect = new SqliteDialect({
    database: sqliteDb,
  })
  const db = new Kysely<T>({
    dialect,
  })

  const migrator = new Migrator({
    db,
    provider: {
      getMigrations: async () => opts.migrations,
    },
  })

  return {
    migrator,
    db,
  }
}
