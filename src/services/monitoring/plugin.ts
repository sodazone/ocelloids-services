import { FastifyInstance } from 'fastify';

import { Switchboard } from  './switchboard.js';
import { SubscriptionApi } from './api/index.js';

/**
 * Monitoring service Fastify plugin.
 *
 * Exposes the subscription HTTP API and starts the switchboard.
 *
 * @param {FastifyInstance} fastify The Fastify instance.
 */
async function Monitoring(
  fastify: FastifyInstance
) {
  const { log } = fastify;

  const switchboard = new Switchboard(fastify);
  await switchboard.start();

  fastify.addHook('onClose', async () => {
    log.info('Shutting down monitoring service');

    await switchboard.stop();
  });

  await fastify.register(SubscriptionApi, {
    switchboard,
  });
}

export default Monitoring;