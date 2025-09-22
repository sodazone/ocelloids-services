import SQLite from 'better-sqlite3'
import { Kysely, Migration, Migrator, ParseJSONResultsPlugin, SqliteDialect } from 'kysely'

export interface SQLiteOptions {
  filename: string
  migrations: Record<string, Migration>
  options?: SQLite.Options
}

export function createKyselyDatabase<T>(opts: SQLiteOptions) {
  const dialect = new SqliteDialect({
    database: new SQLite(opts.filename, opts.options),
  })
  const db = new Kysely<T>({
    dialect,
    plugins: [new ParseJSONResultsPlugin()],
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
