import { FastifyInstance } from 'fastify'

import { CAP_READ, CAP_WRITE, NodQuerystring } from '@/services/auth.js'

import { SubscriptionPathParams } from '../handlers.js'

const SECONDS_TO_EXPIRE = 15

export async function SubscriptionWebSocketsApi(fastify: FastifyInstance) {
  /**
   * Anti-DOS token issuance.
   *
   * The 'nod' is a JWT (RFC 7519) that holds:
   * - Issuer (automatic from JWT configuration)
   * - Issued at
   * - Expiration
   */
  fastify.get(
    '/ws/nod',
    {
      config: {
        caps: [CAP_READ],
      },
      schema: {
        hide: true,
      },
    },
    async (_, reply) => {
      // seconds since the epoch
      const iat = Math.round(Date.now() / 1_000)
      const exp = iat + SECONDS_TO_EXPIRE

      reply.send({
        token: await reply.jwtSign({
          iat,
          exp,
        }),
      })
    },
  )

  fastify.get<{
    Querystring: NodQuerystring
    Params: SubscriptionPathParams
  }>(
    '/ws/subs/:agentId/:subscriptionId',
    {
      websocket: true,
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
