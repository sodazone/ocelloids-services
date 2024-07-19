import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { CAP_READ, CAP_WRITE, NodQuerystring } from '@/services/auth.js'
import { OnlyOwner, SubscriptionPathParams } from '../handlers.js'
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
    log.info('Shutting down websockets protocol')

    await protocol.stop()
  })

  fastify.get<{
    Querystring: NodQuerystring
    Params: SubscriptionPathParams
  }>(
    '/ws/subs/:agentId/:subscriptionId',
    {
      websocket: true,
      preHandler: [OnlyOwner],
      config: { wsAuth: true, caps: [CAP_READ] },
      schema: { hide: true },
    },
    (socket, request): void => {
      const { agentId, subscriptionId } = request.params
      setImmediate(() => protocol.handle(socket, request, { agentId, subscriptionId }))
    },
  )

  fastify.get<{
    Querystring: NodQuerystring
  }>(
    '/ws/subs',
    { websocket: true, config: { wsAuth: true, caps: [CAP_WRITE] }, schema: { hide: true } },
    (socket, request): void => {
      setImmediate(() => protocol.handle(socket, request))
    },
  )
}

export default fp(websocketProtocolPlugin, {
  fastify: '>=4.x',
  name: 'ws-protocol',
})
