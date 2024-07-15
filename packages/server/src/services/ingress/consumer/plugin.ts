import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { IngressOptions } from '../../../types.js'
import { DistributedIngressConsumer, IngressConsumer, LocalIngressConsumer } from './index.js'
import { ConsumerApi } from './routes.js'

declare module 'fastify' {
  interface FastifyInstance {
    ingress: IngressConsumer
  }
}

/**
 * Fastify plug-in for instantiating an {@link IngressConsumer} instance.
 *
 * The plug-in initializes either a distributed or a local implementation based on the `distributed` configuration option.
 *
 * @param fastify - The Fastify instance.
 * @param options - Options for configuring the IngressConsumer.
 */
const ingressConsumerPlugin: FastifyPluginAsync<IngressOptions> = async (fastify, options) => {
  const consumer: IngressConsumer = options.distributed
    ? new DistributedIngressConsumer(fastify, options)
    : new LocalIngressConsumer(fastify)

  fastify.addHook('onClose', (server, done) => {
    consumer
      .stop()
      .then(() => {
        server.log.info('Ingress consumer stopped')
      })
      .catch((error) => {
        server.log.error(error, 'Error while stopping ingress consumer')
      })
      .finally(() => {
        done()
      })
  })

  fastify.decorate('ingress', consumer)

  fastify.register(ConsumerApi)

  await consumer.start()
}

export default fp(ingressConsumerPlugin, { fastify: '>=4.x', name: 'ingress-consumer' })
