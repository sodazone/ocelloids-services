import { FastifyInstance, FastifyRequest } from 'fastify'
import { ulid } from 'ulidx'

import { NotFound, ValidationError } from '@/errors.js'
import { CAP_ADMIN, CAP_READ, CAP_WRITE } from '../auth/index.js'
import { AccountsRepository } from './repository.js'

const DEFAULT_EXPIRATION_SECONDS = 7_889_400 // 3 months
const INVITE_SCOPE = [CAP_READ, CAP_WRITE, 'invite'].join(' ')

interface InvitationQueryString {
  subject: string
  expiresIn?: number
}

type ScopeFlags = {
  read: boolean
  write: boolean
}

const TokenSchema = {
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
}

function scopeFromFlags(flags: ScopeFlags) {
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

  return scope.join(' ')
}

// Create an unsigned token with specific properties
async function createUnsignedToken(
  repository: AccountsRepository,
  {
    accountId,
    subject,
    scope,
    expiresIn,
  }: {
    accountId: number
    subject: string
    scope: string
    expiresIn?: number
  },
) {
  const jti = ulid()

  await repository.createApiToken({
    id: jti,
    account_id: accountId,
    status: 'enabled',
    scope,
  })

  const iat = Math.round(Date.now() / 1_000)
  const exp = iat + (expiresIn ?? DEFAULT_EXPIRATION_SECONDS)

  return {
    iat,
    exp,
    jti,
    sub: subject,
  }
}

/**
 * HTTP API for accounts and API tokens related functionality.
 */
export async function AccountsApi(api: FastifyInstance) {
  const { accountsRepository } = api

  // Retrieve account from request
  function accountFromRequest(request: FastifyRequest) {
    const { account } = request
    if (account) {
      return account
    }
    throw new NotFound('account not found')
  }

  // Route for deleting the current account
  api.delete(
    '/myself',
    {
      config: {
        caps: [CAP_WRITE],
      },
      schema: {
        hide: true,
        tags: ['accounts'],
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const account = accountFromRequest(request)
      await accountsRepository.deleteAccount(account.id)
      reply.send()
    },
  )

  // Route for retrieving the current account
  api.get(
    '/myself',
    {
      config: {
        caps: [CAP_READ],
      },
      schema: {
        tags: ['accounts'],
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const account = accountFromRequest(request)
      reply.send(account)
    },
  )

  // Route for retrieving API tokens for the current account
  api.get(
    '/myself/tokens',
    {
      config: {
        caps: [CAP_READ],
      },
      schema: {
        tags: ['accounts'],
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const account = accountFromRequest(request)
      const tokens = await accountsRepository.findApiTokensByAccount(account.id)
      reply.send(tokens)
    },
  )

  // Route for creating a new API token for the current account
  api.post<{
    Body: {
      scope: ScopeFlags
    }
  }>(
    '/myself/tokens',
    {
      config: {
        caps: [CAP_WRITE],
      },
      schema: {
        tags: ['accounts'],
        security: [{ BearerAuth: [] }],
        body: TokenSchema,
      },
    },
    async (request, reply) => {
      const account = accountFromRequest(request)
      const scope = scopeFromFlags(request.body.scope)

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

  api.patch<{
    Params: {
      tokenId: string
    }
    Body: {
      scope: {
        read: boolean
        write: boolean
      }
    }
  }>(
    '/accounts/tokens/:tokenId',
    {
      config: {
        caps: [CAP_ADMIN],
      },
      schema: {
        hide: true,
        tags: ['accounts'],
        security: [{ BearerAuth: [] }],
        body: TokenSchema,
      },
    },
    async (request, reply) => {
      const { tokenId } = request.params
      const token = await accountsRepository.findApiTokenById(tokenId)
      if (token) {
        const scope = scopeFromFlags(request.body.scope)

        await accountsRepository.updateApiToken(tokenId, {
          scope,
        })
        reply.send()
      }
      throw new NotFound('token not found')
    },
  )

  // Route for deleting an API token in the current account
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
      schema: {
        hide: true,
        tags: ['accounts'],
        security: [{ BearerAuth: [] }],
      },
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

  // Route for administrator issued invites
  // NOTE: GET for easier integration
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
            expiresIn: { type: 'number' },
          },
          required: ['subject'],
        },
        tags: ['accounts'],
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { subject, expiresIn } = request.query

      try {
        const account = await accountsRepository.createAccount({
          subject,
          status: 'enabled',
        })

        const unsignedToken = await createUnsignedToken(accountsRepository, {
          accountId: account.id,
          subject,
          scope: INVITE_SCOPE,
          expiresIn,
        })

        reply.send({
          token: await reply.jwtSign(unsignedToken),
        })
      } catch (error) {
        throw new ValidationError((error as Error).message)
      }
    },
  )

  // Admin can delete accounts
  api.delete<{
    Params: {
      subject: string
    }
  }>(
    '/account/:subject',
    {
      config: {
        caps: [CAP_ADMIN],
      },
      schema: {
        hide: true,
        tags: ['accounts'],
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const account = await accountsRepository.findAccountBySubject(request.params.subject)
      if (account) {
        await accountsRepository.deleteAccount(account.id)
        reply.send()
      } else {
        throw new NotFound('account not found')
      }
    },
  )
}
