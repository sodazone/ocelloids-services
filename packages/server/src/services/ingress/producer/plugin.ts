import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { IngressOptions } from '../../../types.js'
import IngressProducer from './index.js'

declare module 'fastify' {
  interface FastifyInstance {
    ingressProducer: IngressProducer
  }
}

/**
 * Fastify plug-in for the {@link IngressProducer} instance.
 *
 * @param fastify - The Fastify instance.
 * @param options - The options for configuring the IngressProducer.
 */
const IngressProducerPlugin: FastifyPluginAsync<IngressOptions> = async (fastify, options) => {
  const producer = new IngressProducer(fastify, options)

  fastify.addHook('onClose', (server, done) => {
    producer
      .stop()
      .then(() => {
        server.log.info('Ingress stopped')
      })
      .catch((error) => {
        server.log.error(error, 'Error while stopping ingress')
      })
      .finally(() => {
        done()
      })
  })

  fastify.decorate('ingressProducer', producer)

  await producer.start()
}

export default fp(IngressProducerPlugin, {
  fastify: '>=4.x',
  name: 'ingress-producer',
  dependencies: ['config', 'connector'],
})
