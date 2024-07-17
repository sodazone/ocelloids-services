import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import rateLimit from '@fastify/rate-limit'

import { environment, isNonProdEnv } from '@/environment.js'

type LimitOptions = {
  rateLimitMax: number
  rateLimitWindow: number
}

const limitPlugin: FastifyPluginAsync<LimitOptions> = async (fastify, opts) => {
  if (isNonProdEnv(environment)) {
    fastify.log.warn('(!) Rate limits are disabled [%s]', environment)

    return
  }

  await fastify.register(rateLimit, {
    global: true,
    max: opts.rateLimitMax,
    timeWindow: opts.rateLimitWindow,
    hook: 'preHandler',
    /*keyGenerator: function (request) {
      return request.headers['x-real-ip'] // nginx
      || request.headers['x-client-ip'] // apache
      || request.ip*/
  })

  fastify.setNotFoundHandler(
    {
      preHandler: fastify.rateLimit(),
    },
    function (_, reply) {
      reply.code(404).send()
    },
  )
}

export default fp(limitPlugin)
