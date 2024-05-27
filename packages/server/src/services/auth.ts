import jwt from '@fastify/jwt'
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

import { environment } from '../environment.js'

declare module 'fastify' {
  interface FastifyInstance {
    auth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  if (environment !== 'development' && !process.env.OC_SECRET) {
    fastify.log.warn('!! Default OC_SECRET configured !!')
  }

  fastify.register(jwt, {
    secret: process.env.OC_SECRET ?? 'IAO Abraxas Sabaoth',
  })
  fastify.decorate('auth', async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send(err)
    }
  })
}

export default fp(authPlugin)
