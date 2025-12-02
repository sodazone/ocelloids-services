import { FastifyInstance } from 'fastify'
import { CAP_READ } from '@/services/auth/index.js'

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
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    (_, reply) => {
      const { substrate, bitcoin, evm } = ingress
      reply.send({
        substrate: substrate.getChainIds(),
        bitcoin: bitcoin.getChainIds(),
        evm: evm.getChainIds(),
      })
    },
  )
}
