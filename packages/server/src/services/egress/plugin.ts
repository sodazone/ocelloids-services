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

  // TODO: egress start, maybe pass fastify to allow registering webhooks?

  fastify.addHook('onClose', async () => {
    fastify.log.info('[egress] stopping')
    await egress.stop()
  })
}

export default fp(egressPlugin, { fastify: '>=4.x', name: 'egress' })
