import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { AgentServiceMode, AgentServiceOptions } from '../types.js'
import { LocalAgentService } from './local.js'
import { AgentService } from './types.js'

declare module 'fastify' {
  interface FastifyInstance {
    agentService: AgentService
  }
}

/**
 * Fastify plug-in for instantiating an {@link AgentService} instance.
 *
 * @param fastify The Fastify instance.
 * @param options Options for configuring the IngressConsumer.
 */
const agentServicePlugin: FastifyPluginAsync<AgentServiceOptions> = async (fastify, options) => {
  if (options.mode !== AgentServiceMode.local) {
    throw new Error('Only local agent service is supported')
  }
  const service: AgentService = new LocalAgentService(fastify, options)

  fastify.addHook('onClose', (server, done) => {
    service
      .stop()
      .then(() => {
        server.log.info('Agent service stopped')
      })
      .catch((error: any) => {
        server.log.error(error, 'Error while stopping agent service')
      })
      .finally(() => {
        done()
      })
  })

  fastify.decorate('agentService', service)

  await service.start()
}

export default fp(agentServicePlugin, { fastify: '>=4.x', name: 'agent-service' })
