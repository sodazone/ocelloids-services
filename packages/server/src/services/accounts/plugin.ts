import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { AccountsApi } from './routes.js'

const accountsPlugin: FastifyPluginAsync = async (fastify, _options) => {
  fastify.register(AccountsApi)
}

export default fp(accountsPlugin, { fastify: '>=4.x', name: 'accounts' })
