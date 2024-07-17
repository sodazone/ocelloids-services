import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Kysely } from 'kysely'

import { KyselyServerOptions } from '@/types.js'
import { migrate, openDatabase } from './database/db.js'
import { Database } from './database/types.js'

declare module 'fastify' {
  interface FastifyKyselyNamespaces {
    sqliteDB: Kysely<Database>
  }

  interface FastifyInstance {
    kysely: FastifyKyselyNamespaces
  }
}

const kyselyPlugin: FastifyPluginAsync<KyselyServerOptions> = async (fastify, options) => {
  const filename = options.sqlData ?? ':memory:'
  
  fastify.log.info('[kysely] open sqlite database at %s', filename)

  const db = openDatabase({
    filename,
  })

  fastify.decorate('kysely', Object.create(null))
  fastify.kysely.sqliteDB = db

  fastify.addHook('onClose', async () => {
    fastify.log.info('[kysely] closing sqlite database')

    return fastify.kysely.sqliteDB.destroy()
  })

  // run migrations
  await migrate(db)
}

export default fp(kyselyPlugin, { fastify: '>=4.x', name: 'kysely' })
