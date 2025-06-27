import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import WebsocketProtocol from './protocol.js'
import { SubscriptionWebSocketsApi } from './routes.js'

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
 * Note that authentication is disabled in the protocol upgrade handshake.
 * See {@link WebsocketProtocol}.
 *
 * @param fastify - The Fastify instance
 */
const websocketProtocolPlugin: FastifyPluginAsync<WebsocketProtocolOptions> = async (fastify, options) => {
  const { log, switchboard } = fastify

  const protocol = new WebsocketProtocol(log, switchboard, options)

  fastify.decorate('wsProtocol', protocol)

  fastify.addHook('onClose', async () => {
    log.info('[ws] shutting down websockets protocol')

    await protocol.stop()
  })

  await fastify.register(SubscriptionWebSocketsApi)
}

export default fp(websocketProtocolPlugin, {
  fastify: '>=4.x',
  name: 'ws-protocol',
})
