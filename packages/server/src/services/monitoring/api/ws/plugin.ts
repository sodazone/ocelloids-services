import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { AgentId } from 'services/monitoring/types.js'
import WebsocketProtocol from './protocol.js'

declare module 'fastify' {
  interface FastifyInstance {
    wsProtocol: WebsocketProtocol
  }
}

export type WebsocketProtocolOptions = {
  wsMaxClients?: number
}

/**
 * Websocket subscription protocol plug-in.
 *
 * @param fastify The fastify instance
 */
const websocketProtocolPlugin: FastifyPluginAsync<WebsocketProtocolOptions> = async (fastify, options) => {
  const { log, switchboard } = fastify

  const protocol = new WebsocketProtocol(log, switchboard, options)

  fastify.decorate('wsProtocol', protocol)

  fastify.addHook('onClose', async () => {
    log.info('Shutting down websockets protocol')

    await protocol.stop()
  })

  fastify.get<{
    Params: {
      agent: AgentId
      id: string
    }
  }>('/ws/subs/:agent/:id', { websocket: true, schema: { hide: true } }, (socket, request): void => {
    const { id, agent } = request.params
    setImmediate(() => protocol.handle(socket, request, { agent, id }))
  })

  fastify.get('/ws/subs', { websocket: true, schema: { hide: true } }, (socket, request): void => {
    setImmediate(() => protocol.handle(socket, request))
  })
}

export default fp(websocketProtocolPlugin, {
  fastify: '>=4.x',
  name: 'ws-protocol',
})
