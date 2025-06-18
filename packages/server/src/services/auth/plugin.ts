import fs from 'node:fs'

import jwt from '@fastify/jwt'
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

import { expandRegExps } from '@/cli/index.js'
import { environment, isNonProdEnv } from '@/environment.js'
import { JwtServerOptions } from '@/types.js'

import { AccountWithCaps } from '../accounts/types.js'
import { importKeys } from './keys.js'
import { ensureAccountAuthorized } from './rules.js'
import { JwtPayload, NodQuerystring } from './types.js'

declare module 'fastify' {
  interface FastifyInstance {
    authEnabled?: boolean
  }
  interface FastifyContextConfig {
    caps?: string[]
    wsAuth?: boolean
  }
  interface FastifyRequest {
    account?: AccountWithCaps
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

  const keyFilePath = options.jwtSigKeyFile

  fastify.log.info('[auth] Importing keys from %s', keyFilePath)

  const keyData = fs.readFileSync(keyFilePath, 'utf8')
  const secret = importKeys(keyData)

  fastify.log.info('[auth] Key pair imported')

  if (secret.private === undefined) {
    fastify.log.info('[auth] No private key, signing is disabled')
  }

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

        // Apply authorization if caps are configured
        if (config.caps && config.caps.length > 0) {
          // JWT Auth
          const payload = await request.jwtVerify<JwtPayload>()

          // Account Auth
          await ensureAccountAuthorized(fastify, request, payload)
        }
      } catch (error) {
        reply.status(401).send({
          message: (error as Error).message,
          code: 'AUTHORIZATION_ERROR',
          statusCode: 401,
        })
      }
    },
  )
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['accounts'],
})
