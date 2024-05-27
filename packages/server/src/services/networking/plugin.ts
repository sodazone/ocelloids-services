import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import Connector from './connector.js'

declare module 'fastify' {
  interface FastifyInstance {
    connector: Connector
  }
}

const connectorPlugin: FastifyPluginAsync = async (fastify) => {
  if (fastify.localConfig === undefined) {
    return
  }

  const connector = new Connector(fastify.log, fastify.localConfig)
  fastify.decorate('connector', connector)

  fastify.addHook('onClose', (_, done) => {
    connector.disconnect().finally(done)
  })
}

export default fp(connectorPlugin, { fastify: '>=4.x', name: 'connector' })
