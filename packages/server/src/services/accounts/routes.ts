import { FastifyInstance } from 'fastify'

import { CAP_ADMIN, CAP_READ, CAP_WRITE } from '../auth.js'

interface InvitationQueryString {
  subject: string
}

export async function AccountsApi(api: FastifyInstance) {
  api.get<{
    Querystring: InvitationQueryString
  }>(
    '/accounts/invite',
    {
      config: {
        caps: [CAP_ADMIN],
      },
      schema: {
        hide: true,
        querystring: {
          type: 'object',
          properties: {
            subject: { type: 'string' },
          },
          required: ['subject'],
        },
      },
    },
    async (request, reply) => {
      const { subject } = request.query
      const iat = Math.round(Date.now() / 1_000)
      reply.send({
        token: await reply.jwtSign({
          iat,
          aud: 'api.ocelloids.net',
          // TODO: impl nbf and exp
          // nbf
          // exp: 6 MONTHS after nbf
          sub: subject,
          scope: [CAP_READ, CAP_WRITE, 'invite'].join(' '),
        }),
      })
    },
  )
}
