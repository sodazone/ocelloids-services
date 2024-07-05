import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { AgentCatalogOptions, AgentServiceMode } from '../../types.js'
import { AgentsApi } from './api/routes.js'
import { LocalAgentCatalog } from './catalog/local.js'
import { AgentCatalog } from './types.js'

declare module 'fastify' {
  interface FastifyInstance {
    agentCatalog: AgentCatalog
  }
}

/**
 * Fastify plug-in for instantiating an {@link AgentCatalog} instance.
 *
 * @param fastify - The Fastify instance.
 * @param options - Options for configuring the Agent Service.
 */
const agentServicePlugin: FastifyPluginAsync<AgentCatalogOptions> = async (fastify, options) => {
  if (options.mode !== AgentServiceMode.local) {
    throw new Error('Only local agent service is supported')
  }

  const catalog: AgentCatalog = new LocalAgentCatalog(fastify, options)

  fastify.decorate('agentCatalog', catalog)

  await AgentsApi(fastify)

  await catalog.start()

  fastify.addHook('onClose', (server, done) => {
    catalog
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
}

export default fp(agentServicePlugin, { fastify: '>=4.x', name: 'agent-service' })
