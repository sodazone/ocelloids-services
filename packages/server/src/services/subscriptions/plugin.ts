import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { SubscriptionApi } from './api/index.js'
import WebsocketProtocolPlugin, { WebsocketProtocolOptions } from './api/ws/plugin.js'
import { Switchboard, SwitchboardOptions } from './switchboard.js'

declare module 'fastify' {
  interface FastifyInstance {
    switchboard: Switchboard
  }
}

type SubscriptionsOptions = SwitchboardOptions & WebsocketProtocolOptions

/**
 * Monitoring service Fastify plugin.
 *
 * Exposes the subscription HTTP API and starts the switchboard.
 *
 * @param {FastifyInstance} fastify - The Fastify instance.
 */
const subscriptionsPlugin: FastifyPluginAsync<SubscriptionsOptions> = async (fastify, options) => {
  const { log } = fastify

  const switchboard = new Switchboard(fastify, options)

  fastify.decorate('switchboard', switchboard)
  await switchboard.start()

  fastify.addHook('onClose', async () => {
    log.info('Shutting down monitoring service')

    await switchboard.stop()
  })

  await fastify.register(SubscriptionApi)
  await fastify.register(WebsocketProtocolPlugin, options)
}

export default fp(subscriptionsPlugin, { fastify: '>=4.x', name: 'subscriptions' })
