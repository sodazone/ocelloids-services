import SQLite from 'better-sqlite3'
import { Kysely, Migration, Migrator, PostgresDialect, SqliteDialect } from 'kysely'
import { Pool } from 'pg'

export interface SQLiteOptions {
  dialect: 'sqlite'
  filename: string
  migrations: Record<string, Migration>
  options?: SQLite.Options
}

export interface PostgresOptions {
  dialect: 'postgres'
  connectionString: string
  migrations: Record<string, Migration>
  poolOptions?: any
}

export type DatabaseOptions = SQLiteOptions | PostgresOptions

export type DbConnectionInfo =
  | { dialect: 'sqlite'; filename: string }
  | { dialect: 'postgres'; connectionString: string }

export type SQLDialect = 'sqlite' | 'postgres'

/**
 * Parses a connection string and returns normalized DB info
 */
export function parseConnectionString(connectionString: string): DbConnectionInfo {
  if (connectionString === ':memory:' || connectionString.startsWith('sqlite:')) {
    const filename = connectionString === ':memory:' ? ':memory:' : connectionString.split(':')[1]
    return { dialect: 'sqlite', filename }
  } else if (connectionString.startsWith('postgres://') || connectionString.startsWith('postgresql://')) {
    return { dialect: 'postgres', connectionString }
  } else {
    // fallback assume filename
    return { dialect: 'sqlite', filename: connectionString }
  }
}

export function createKyselyDatabase<T>(opts: DatabaseOptions) {
  let db: Kysely<T>

  if (opts.dialect === 'sqlite') {
    const sqliteDb = new SQLite(opts.filename, opts.options)

    sqliteDb.pragma('journal_mode = WAL')
    sqliteDb.pragma('cache_size = 10000') // ~40 MB page cache
    sqliteDb.pragma('synchronous = NORMAL')
    sqliteDb.pragma('temp_store = MEMORY')

    const dialect = new SqliteDialect({
      database: sqliteDb,
    })

    db = new Kysely<T>({
      dialect,
    })
  } else {
    const pool = new Pool({
      connectionString: opts.connectionString,
      ...(opts.poolOptions || {}),
    })

    const dialect = new PostgresDialect({
      pool,
    })

    db = new Kysely<T>({
      dialect,
    })
  }

  const migrator = new Migrator({
    db,
    provider: {
      getMigrations: async () => opts.migrations,
    },
  })

  return {
    migrator,
    db,
    dialect: opts.dialect,
  }
}
