import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { AccountsRepository } from './repository.js'
import { AccountsApi } from './routes.js'

declare module 'fastify' {
  interface FastifyInstance {
    accountsRepository: AccountsRepository
  }
}

const accountsPlugin: FastifyPluginAsync = async (fastify, _) => {
  fastify.register(AccountsApi)

  const accountsRepository = new AccountsRepository(fastify.kysely.sqliteDB)

  fastify.decorate('accountsRepository', accountsRepository)
}

export default fp(accountsPlugin, { fastify: '>=4.x', name: 'accounts', dependencies: ['kysely'] })
