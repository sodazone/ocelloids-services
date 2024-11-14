import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { IngressOptions } from '@/types.js'
import SubstrateIngressProducer from '../../networking/substrate/ingress/producer.js'
import { IngressProducers } from './types.js'

declare module 'fastify' {
  interface FastifyInstance {
    ingressProducers: IngressProducers
  }
}

/**
 * Fastify plug-in for the {@link SubstrateIngressProducer} instance.
 *
 * @param fastify - The Fastify instance.
 * @param options - The options for configuring the IngressProducer.
 */
const IngressProducerPlugin: FastifyPluginAsync<IngressOptions> = async (fastify, options) => {
  const substrateProducer = new SubstrateIngressProducer(fastify, options)

  const producers: IngressProducers = {
    substrate: substrateProducer,
  }

  fastify.addHook('onClose', (server, done) => {
    for (const [key, producer] of Object.entries(producers)) {
      producer
        .stop()
        .then(() => {
          server.log.info('[%s] Ingress stopped', key)
        })
        .catch((error) => {
          server.log.error(error, '[%s] Error while stopping ingress', key)
        })
        .finally(() => {
          done()
        })
    }
  })

  fastify.decorate('ingressProducers', producers)

  for (const producer of Object.values(producers)) {
    await producer.start()
  }
}

export default fp(IngressProducerPlugin, {
  fastify: '>=4.x',
  name: 'ingress-producer',
  dependencies: ['config', 'connector'],
})
