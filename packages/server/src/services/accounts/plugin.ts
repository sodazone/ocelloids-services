import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { DatabaseOptions, KyselyServerOptions } from '@/types.js'

import { resolveDataPath } from '../persistence/util.js'
import { createSystemDatabase } from './db.js'
import { AccountsRepository } from './repository.js'
import { AccountsApi } from './routes.js'

declare module 'fastify' {
  interface FastifyInstance {
    accountsRepository: AccountsRepository
  }
}

type KyselyOptions = DatabaseOptions & KyselyServerOptions

const accountsPlugin: FastifyPluginAsync<KyselyOptions> = async (fastify, { data }) => {
  const filename = resolveDataPath('db.sqlite', data)

  fastify.log.info('[accounts] system database at %s', filename)

  const { db, migrator } = createSystemDatabase(filename)
  const accountsRepository = new AccountsRepository(db)

  fastify.decorate('accountsRepository', accountsRepository)

  fastify.register(AccountsApi)

  fastify.addHook('onClose', async () => {
    fastify.log.info('[accounts] closing system database')

    return db.destroy()
  })

  await migrator.migrateToLatest()
}

export default fp(accountsPlugin, { fastify: '>=4.x', name: 'accounts' })
