import { CAP_READ } from '@/services/auth/index.js'
import { FastifyInstance } from 'fastify'

export async function ConsumerApi(api: FastifyInstance) {
  const { ingress } = api

  api.get(
    '/ingress/networks',
    {
      config: {
        caps: [CAP_READ],
      },
      schema: {
        tags: ['ingress'],
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      },
    },
    (_, reply) => {
      reply.send(ingress.getChainIds())
    },
  )
}
