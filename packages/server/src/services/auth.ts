import jwt from '@fastify/jwt'
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

import { environment } from '../environment.js'

// TODO CAP_OWNER
export const CAP_ADMIN = 'admin'
export const CAP_READ = 'read'
export const CAP_WRITE = 'write'

// XXX To be implemented
// user and capabilities management
const capabilities = [['admin'], ['read', 'write'], ['read']]

declare module 'fastify' {
  interface FastifyInstance {
    authEnabled?: boolean
  }
  interface FastifyContextConfig {
    caps?: string[]
    skipAuth?: boolean
  }
}

export function checkCapabilities(subject: string, requestedCaps: string[] = [CAP_ADMIN]) {
  const caps = capabilities[parseInt(subject)]

  if (requestedCaps.length === 0 || requestedCaps.every((required) => caps.includes(required))) {
    return
  }

  throw new Error('Not allowed')
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  if (['development', 'test'].includes(environment) && process.env.OC_SECRET === undefined) {
    fastify.log.warn('(!) Security is disabled [%s]', environment)
    fastify.decorate('authEnabled', false)
    return
  }

  if (environment !== 'development' && !process.env.OC_SECRET) {
    fastify.log.warn('!! Default OC_SECRET configured !!')
  }

  fastify.decorate('authEnabled', true)

  fastify.register(jwt, {
    secret: process.env.OC_SECRET ?? 'IAO Abraxas Sabaoth',
  })

  // Install hook for any route
  fastify.addHook('preValidation', async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (request.routeOptions.config.skipAuth) {
      return
    }

    try {
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
  })
}

export default fp(authPlugin)
