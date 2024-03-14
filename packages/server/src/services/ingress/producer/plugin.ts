import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import IngressProducer from './index.js';
import { IngressOptions } from '../../../types.js';

/**
 * Fastify plug-in for the {@link IngressProducer} instance.
 *
 * @param fastify The Fastify instance.
 * @param options Options for configuring the IngressProducer.
 */
const IngressProducerPlugin: FastifyPluginAsync<IngressOptions> = async (fastify, options) => {
  const producer = new IngressProducer(fastify, options);

  fastify.addHook('onClose', (server, done) => {
    producer
      .stop()
      .then(() => {
        server.log.info('Ingress stopped');
      })
      .catch((error) => {
        server.log.error(error, 'Error while stopping ingress');
      })
      .finally(() => {
        done();
      });
  });

  await producer.start();
};

export default fp(IngressProducerPlugin, {
  fastify: '>=4.x',
  name: 'ingress-producer',
  dependencies: ['config', 'connector'],
});
