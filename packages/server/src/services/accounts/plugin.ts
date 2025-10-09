import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { DatabaseOptions } from '@/types.js'

import { resolveDataPath } from '../persistence/util.js'
import { createSystemDatabase } from './db.js'
import { AccountsRepository } from './repository.js'
import { AccountsApi } from './routes.js'

declare module 'fastify' {
  interface FastifyInstance {
    accountsRepository: AccountsRepository
  }
}

const accountsPlugin: FastifyPluginAsync<DatabaseOptions> = async (fastify, { data }) => {
  const filename = resolveDataPath('db.sqlite', data)

  fastify.log.info('[accounts] database at %s', filename)

  const { db, migrator } = createSystemDatabase(filename)
  const accountsRepository = new AccountsRepository(db)

  fastify.decorate('accountsRepository', accountsRepository)

  fastify.register(AccountsApi)

  fastify.addHook('onClose', async () => {
    fastify.log.info('[accounts] closing database')

    return db.destroy()
  })

  await migrator.migrateToLatest()
}

export default fp(accountsPlugin, { fastify: '>=4.x', name: 'accounts' })
