import { FastifyInstance } from 'fastify'

import { CAP_ADMIN, CAP_READ, CAP_WRITE } from '../auth.js'
import { NewAccount, NewApiToken } from '../persistence/kysely/database/types.js'

import { ulid } from 'ulidx'

interface InvitationQueryString {
  subject: string
}

export async function AccountsApi(api: FastifyInstance) {
  const { accountsRepository } = api

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
      const jti = ulid()

      const account = await accountsRepository.createAccount({
        subject,
        status: 'enabled',
      })

      if (account === undefined) {
        throw new Error('bla')
      }

      const apiToken = await accountsRepository.createApiToken({
        id: jti,
        account_id: account.id,
        status: 'enabled',
        scope: [CAP_READ, CAP_WRITE, 'invite'].join(' '),
      })

      if (apiToken === undefined) {
        throw new Error('bla')
      }

      const iat = Math.round(Date.now() / 1_000)
      const token = await reply.jwtSign({
        iat,
        jti,
        aud: 'api.ocelloids.net',
        // TODO: impl nbf and exp
        // nbf
        // exp: 6 MONTHS after nbf
        sub: subject,
      })

      reply.send({
        token,
      })
    },
  )
}
