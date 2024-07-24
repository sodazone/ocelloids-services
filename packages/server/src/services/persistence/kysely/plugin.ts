import path from 'node:path'

import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Kysely } from 'kysely'

import { DatabaseOptions, KyselyServerOptions } from '@/types.js'
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

type KyselyOptions = DatabaseOptions & KyselyServerOptions

const kyselyPlugin: FastifyPluginAsync<KyselyOptions> = async (fastify, { data }) => {
  const filename = data && data.length > 0 ? path.join(data, '/sqlite') : ':memory:'

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
