import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { Egress } from './index.js'

declare module 'fastify' {
  interface FastifyInstance {
    egress: Egress
  }
}

const egressPlugin: FastifyPluginAsync = async (fastify) => {
  const egress = new Egress(fastify)

  fastify.decorate('egress', egress)
}

export default fp(egressPlugin, { fastify: '>=4.x', name: 'egress' })
