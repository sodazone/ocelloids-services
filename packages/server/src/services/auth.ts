import jwt from '@fastify/jwt'
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

import { environment, isNonProdEnv } from '../environment.js'

const SECONDS_TO_EXPIRE = 15

// TODO CAP_OWNER
export const CAP_ADMIN = 'admin'
export const CAP_READ = 'read'
export const CAP_WRITE = 'write'

export interface NodQuerystring {
  nod?: string
}

// TODO #71 #92 To be implemented
// user and capabilities management
const capabilities = [['admin', 'read', 'write'], ['read', 'write'], ['read']]

declare module 'fastify' {
  interface FastifyInstance {
    authEnabled?: boolean
  }
  interface FastifyContextConfig {
    caps?: string[]
    wsAuth?: boolean
  }
}

export function checkCapabilities(subject: string | undefined, requestedCaps: string[] = [CAP_ADMIN]) {
  if (subject) {
    const caps = capabilities[parseInt(subject)]

    if (requestedCaps.length === 0 || requestedCaps.every((required) => caps.includes(required))) {
      return
    }
  }

  throw new Error('Not allowed')
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  if (isNonProdEnv(environment) && process.env.OC_SECRET === undefined) {
    fastify.log.warn('(!) Security is disabled [%s]', environment)
    fastify.decorate('authEnabled', false)
    return
  }

  if (process.env.OC_SECRET === undefined) {
    throw new Error(`Fatal: you must provide an OC_SECRET in [${environment}]`)
  }

  fastify.decorate('authEnabled', true)

  fastify.register(jwt, {
    secret: process.env.OC_SECRET,
  })

  // Install hook for any route
  fastify.addHook(
    'preValidation',
    async function (
      request: FastifyRequest<{
        Querystring: NodQuerystring
      }>,
      reply: FastifyReply
    ): Promise<void> {
      try {
        if (request.routeOptions.config.wsAuth) {
          if (request.query.nod) {
            fastify.jwt.verify(request.query.nod)
            return
          }
          throw new Error('anti-dos parameter not provided')
        }

        const payload: {
          sub: string
        } = await request.jwtVerify()

        checkCapabilities(payload.sub, request.routeOptions.config.caps)
      } catch (error) {
        reply.status(401).send({
          message: (error as Error).message,
          code: 'AUTHORIZATION_ERROR',
          statusCode: 401,
        })
      }
    }
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
    }
  )
}

export default fp(authPlugin)
