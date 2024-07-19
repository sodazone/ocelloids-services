import { FastifyInstance } from 'fastify'

import { CAP_READ, CAP_WRITE, NodQuerystring } from '@/services/auth.js'

import { PublicOrOwner, SubscriptionPathParams } from '../handlers.js'

export async function SubscriptionWebSocketsApi(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: NodQuerystring
    Params: SubscriptionPathParams
  }>(
    '/ws/subs/:agentId/:subscriptionId',
    {
      websocket: true,
      preHandler: [PublicOrOwner],
      config: { wsAuth: true, caps: [CAP_READ] },
      schema: { hide: true },
    },
    (socket, request): void => {
      const { agentId, subscriptionId } = request.params
      setImmediate(() => fastify.wsProtocol.handle(socket, request, { agentId, subscriptionId }))
    },
  )

  fastify.get<{
    Querystring: NodQuerystring
  }>(
    '/ws/subs',
    { websocket: true, config: { wsAuth: true, caps: [CAP_WRITE] }, schema: { hide: true } },
    (socket, request): void => {
      setImmediate(() => fastify.wsProtocol.handle(socket, request))
    },
  )
}
