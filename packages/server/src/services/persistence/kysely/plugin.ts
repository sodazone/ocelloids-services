import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Kysely } from 'kysely'

import { KyselyServerOptions } from '@/types.js'
import { openDatabase } from './database/db.js'
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
  fastify.log.info('[kysely] Open sqlite %s', filename)

  const db = openDatabase({
    filename,
  })

  fastify.decorate('kysely', Object.create(null))
  fastify.kysely.sqliteDB = db

  fastify.addHook('onClose', async () => {
    fastify.log.info('[kysely] Closing sqlite')

    return fastify.kysely.sqliteDB.destroy()
  })
}

export default fp(kyselyPlugin, { fastify: '>=4.x', name: 'kysely' })
