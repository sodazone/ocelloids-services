import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { BitcoinLocalConsumer } from '@/services/networking/bitcoin/ingress/local.js'
import {
  SubstrateDistributedConsumer,
  SubstrateLocalConsumer,
} from '@/services/networking/substrate/ingress/index.js'
import { IngressOptions } from '@/types.js'

import { ConsumerApi } from './routes.js'
import { IngressConsumers } from './types.js'

declare module 'fastify' {
  interface FastifyInstance {
    ingress: IngressConsumers
  }
}

/**
 * Fastify plug-in for instantiating {@link IngressConsumers}.
 *
 * The plug-in initializes either a distributed or a local implementation based on the `distributed` configuration option.
 *
 * @param fastify - The Fastify instance.
 * @param options - Options for configuring an IngressConsumer.
 */
const ingressConsumerPlugin: FastifyPluginAsync<IngressOptions> = async (fastify, options) => {
  const substrateConsumer = options.distributed
    ? new SubstrateDistributedConsumer(fastify, options)
    : new SubstrateLocalConsumer(fastify)
  const bitcoinConsumer = new BitcoinLocalConsumer(fastify)

  const consumers: IngressConsumers = {
    substrate: substrateConsumer,
    bitcoin: bitcoinConsumer,
  }

  fastify.addHook('onClose', (server, done) => {
    for (const [key, consumer] of Object.entries(consumers)) {
      consumer
        .stop()
        .then(() => {
          server.log.info('[%s] Ingress consumer stopped', key)
        })
        .catch((error) => {
          server.log.error(error, '[%s] Error while stopping ingress consumer', key)
        })
        .finally(() => {
          done()
        })
    }
  })

  fastify.decorate('ingress', consumers)

  fastify.register(ConsumerApi)

  for (const consumer of Object.values(consumers)) {
    await consumer.start()
  }
}

export default fp(ingressConsumerPlugin, { fastify: '>=4.x', name: 'ingress-consumer' })
