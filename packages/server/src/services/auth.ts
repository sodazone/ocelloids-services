import { createPrivateKey, createPublicKey } from 'node:crypto'
import fs from 'node:fs'

import jwt from '@fastify/jwt'
import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

import { expandRegExps } from '@/cli/index.js'
import { environment, isNonProdEnv } from '@/environment.js'
import { JwtServerOptions } from '@/types.js'
import { Account } from './persistence/kysely/database/types.js'

const SECONDS_TO_EXPIRE = 15

export const CAP_ADMIN = '*:admin'
export const CAP_READ = '*:read'
export const CAP_WRITE = '*:write'

export interface NodQuerystring {
  nod?: string
}

declare module 'fastify' {
  interface FastifyInstance {
    authEnabled?: boolean
  }
  interface FastifyContextConfig {
    caps?: string[]
    wsAuth?: boolean
  }
  interface FastifyRequest {
    account?: Account
  }
}

export interface JwtPayload {
  sub: string
  jti: string
}

/**
 * Ensure the requested capabilities are present in the scope.
 */
function ensureCapabilities(scope: string, requestedCaps: string[] = [CAP_ADMIN]) {
  if (scope) {
    const caps = scope.split(' ')

    if (requestedCaps.length === 0 || requestedCaps.every((required) => caps.includes(required))) {
      return
    }
  }

  throw new Error('Not allowed')
}

/**
 * Ensure the account associated with the JWT is authorized.
 */
export async function ensureAccountAuthorized(
  { log, accountsRepository }: FastifyInstance,
  request: FastifyRequest,
  payload: JwtPayload,
) {
  if (payload) {
    const { sub, jti } = payload

    const apiToken = await accountsRepository.findApiTokenById(jti)

    if (apiToken?.status === 'enabled') {
      const { account } = apiToken
      if (account) {
        if (account.status === 'enabled' && account.subject === sub) {
          const {
            routeOptions: {
              config: { caps },
            },
          } = request

          ensureCapabilities(apiToken.scope, caps)

          // all OK
          request.account = account
          return
        } else {
          log.warn('[authorization] disabled account attempt %j', apiToken)
        }
      } else {
        log.warn('[authorization] token without associated account %j', apiToken)
      }
    } else {
      log.warn('[authorization] disabled token attempt %j', apiToken)
    }
  }

  throw new Error('Not allowed')
}

/**
 * Import EdDSA keys from a JWK file.
 */
async function importKeys(fastify: FastifyInstance, path: string) {
  try {
    const jwkFile = fs.readFileSync(path, 'utf8')
    const jwkJson = JSON.parse(jwkFile) as Record<string, any>

    fastify.log.info('Importing public JWK key id: %s', jwkJson.kid)
    const pubKey = await createPublicKey({ key: jwkJson, format: 'jwk' })

    if (jwkJson.d) {
      fastify.log.info('Importing private JWK key id: %s', jwkJson.kid)
      const prvKey = await createPrivateKey({ key: jwkJson, format: 'jwk' })

      return {
        public: pubKey.export({ type: 'spki', format: 'pem' }),
        private: prvKey.export({ type: 'pkcs8', format: 'pem' }),
      }
    } else {
      fastify.log.info('No private key, signing is disabled')

      return {
        public: pubKey.export({ type: 'spki', format: 'pem' }),
      }
    }
  } catch (error) {
    throw new Error('Fatal: Error while importing JWK keys', { cause: error })
  }
}

/**
 * Plug-in that provides account-based authorization and JWT authentication.
 */
const authPlugin: FastifyPluginAsync<JwtServerOptions> = async (fastify, options) => {
  if (isNonProdEnv(environment) && !options.jwtAuth) {
    fastify.log.warn('(!) Security is disabled [%s]', environment)
    fastify.decorate('authEnabled', false)
    return
  }

  // In production the 'jwt-auth' options is ignored
  if (options.jwtSigKeyFile === undefined) {
    throw new Error(`Fatal: you must provide an OC_JWT_SIG_KEY_FILE in [${environment}]`)
  }

  fastify.decorate('authEnabled', true)

  const secret = await importKeys(fastify, options.jwtSigKeyFile)

  fastify.register(jwt, {
    secret,
    sign: {
      algorithm: 'EdDSA',
      iss: options.jwtIss,
    },
    verify: {
      allowedIss: expandRegExps(options.jwtAllowedIss),
      algorithms: ['EdDSA'],
    },
  })

  // Install hook for any route
  fastify.addHook(
    'onRequest',
    async function (
      request: FastifyRequest<{
        Querystring: NodQuerystring
      }>,
      reply: FastifyReply,
    ): Promise<void> {
      try {
        const {
          routeOptions: { config },
        } = request

        // WebSockets Auth
        if (config.wsAuth) {
          if (request.query.nod) {
            fastify.jwt.verify(request.query.nod)
            return
          }
          throw new Error('anti-dos parameter not provided')
        }

        // JWT Auth
        const payload = await request.jwtVerify<JwtPayload>()

        // Account Auth
        await ensureAccountAuthorized(fastify, request, payload)
      } catch (error) {
        reply.status(401).send({
          message: (error as Error).message,
          code: 'AUTHORIZATION_ERROR',
          statusCode: 401,
        })
      }
    },
  )

  /**
   * Anti-DOS token issuance.
   *
   * The 'nod' is a JWT (RFC 7519) that holds:
   * - Audience
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
          aud: 'ws-nod',
          iat,
          exp,
        }),
      })
    },
  )
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['accounts'],
})
