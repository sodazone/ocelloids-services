import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import {
  SubstrateDistributedConsumer,
  SubstrateLocalConsumer,
} from '@/services/networking/substrate/ingress/index.js'
import { IngressOptions } from '@/types.js'

import { BitcoinLocalConsumer } from '@/services/networking/bitcoin/ingress/local.js'
import { ConsumerApi } from './routes.js'
import { IngressConsumer, IngressConsumers } from './types.js'

declare module 'fastify' {
  interface FastifyInstance {
    ingress: IngressConsumers
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
  const substrateConsumer = options.distributed
    ? new SubstrateDistributedConsumer(fastify, options)
    : new SubstrateLocalConsumer(fastify)
  const bitcoinConsumer = new BitcoinLocalConsumer(fastify)

  const consumers: IngressConsumers = {
    substrate: substrateConsumer,
    bitcoin: bitcoinConsumer,
  }

  fastify.addHook('onClose', (server, done) => {
    substrateConsumer
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

  fastify.decorate('ingress', consumers)

  fastify.register(ConsumerApi)

  await substrateConsumer.start()
}

export default fp(ingressConsumerPlugin, { fastify: '>=4.x', name: 'ingress-consumer' })
