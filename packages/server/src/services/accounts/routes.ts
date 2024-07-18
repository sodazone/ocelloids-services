import { FastifyInstance, FastifyRequest } from 'fastify'
import { ulid } from 'ulidx'

import { NotFound, ValidationError } from '@/errors.js'
import { CAP_ADMIN, CAP_READ, CAP_WRITE } from '../auth.js'
import { AccountsRepository } from './repository.js'

interface InvitationQueryString {
  subject: string
}

async function createUnsignedToken(
  repository: AccountsRepository,
  {
    accountId,
    subject,
    scope,
  }: {
    accountId: number
    subject: string
    scope: string[]
    aud?: string
  },
) {
  const jti = ulid()

  const apiToken = await repository.createApiToken({
    id: jti,
    account_id: accountId,
    status: 'enabled',
    scope: scope.join(' '),
  })

  if (apiToken === undefined) {
    throw new ValidationError('token not found')
  }

  const iat = Math.round(Date.now() / 1_000)

  return {
    iat,
    jti,
    // TODO: impl nbf and exp
    // nbf
    // exp: 6 MONTHS after nbf
    sub: subject,
  }
}

export async function AccountsApi(api: FastifyInstance) {
  const { accountsRepository } = api

  function accountFromRequest(request: FastifyRequest) {
    const { account } = request
    if (account) {
      return account
    }
    throw new NotFound('account not found')
  }

  api.delete(
    '/myself',
    {
      config: {
        caps: [CAP_WRITE],
      },
      schema: {},
    },
    async (request, reply) => {
      const account = accountFromRequest(request)
      await accountsRepository.deleteAccount(account.id)
      reply.send()
    },
  )

  api.get(
    '/myself',
    {
      config: {
        caps: [CAP_READ],
      },
      schema: {},
    },
    async (request, reply) => {
      const account = accountFromRequest(request)
      reply.send(account)
    },
  )

  api.get(
    '/myself/tokens',
    {
      config: {
        caps: [CAP_READ],
      },
      schema: {},
    },
    async (request, reply) => {
      const account = accountFromRequest(request)
      const tokens = await accountsRepository.findApiTokensByAccount(account.id)
      reply.send(tokens)
    },
  )

  api.post<{
    Body: {
      scope: {
        read: boolean
        write: boolean
      }
    }
  }>(
    '/myself/tokens',
    {
      config: {
        caps: [CAP_WRITE],
      },
      schema: {
        body: {
          type: 'object',
          properties: {
            scope: {
              type: 'object',
              properties: {
                read: { type: 'boolean' },
                write: { type: 'boolean' },
              },
            },
          },
          required: ['scope'],
        },
      },
    },
    async (request, reply) => {
      const account = accountFromRequest(request)
      const flags = request.body.scope
      const scope = []

      if (flags.read) {
        scope.push(CAP_READ)
      }
      if (flags.write) {
        scope.push(CAP_WRITE)
      }
      if (scope.length === 0) {
        throw new ValidationError('please, specify the token scope')
      }

      const unsignedToken = await createUnsignedToken(accountsRepository, {
        accountId: account.id,
        scope,
        subject: account.subject,
      })

      reply.send({
        token: await reply.jwtSign(unsignedToken),
      })
    },
  )

  api.delete<{
    Params: {
      tokenId: string
    }
  }>(
    '/myself/tokens/:tokenId',
    {
      config: {
        caps: [CAP_WRITE],
      },
      schema: {},
    },
    async (request, reply) => {
      const account = accountFromRequest(request)
      const { tokenId } = request.params
      if (await accountsRepository.findApiTokenByAccount(account.id, tokenId)) {
        await accountsRepository.deleteApiToken(tokenId)
        reply.send()
      }
      throw new NotFound('token not found')
    },
  )

  // NOTE: this endpoint is only form admins
  // we use GET for easier integration
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

      const account = await accountsRepository.createAccount({
        subject,
        status: 'enabled',
      })

      if (account === undefined) {
        throw new ValidationError('account not found')
      }

      const unsignedToken = await createUnsignedToken(accountsRepository, {
        accountId: account.id,
        subject,
        scope: [CAP_READ, CAP_WRITE, 'invite'],
      })

      reply.send({
        token: await reply.jwtSign(unsignedToken),
      })
    },
  )
}
