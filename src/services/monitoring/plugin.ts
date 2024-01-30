import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { Switchboard } from  './switchboard.js';
import { SubscriptionApi } from './api/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    switchboard: Switchboard
  }
}

/**
 * Monitoring service Fastify plugin.
 *
 * Exposes the subscription HTTP API and starts the switchboard.
 *
 * @param {FastifyInstance} fastify The Fastify instance.
 */
const monitoringPlugin: FastifyPluginAsync = async fastify => {
  const { log } = fastify;

  const switchboard = new Switchboard(fastify);
  fastify.decorate('switchboard', switchboard);
  await switchboard.start();

  fastify.addHook('onClose', async () => {
    log.info('Shutting down monitoring service');

    await switchboard.stop();
  });

  await fastify.register(SubscriptionApi, {
    switchboard,
  });
};

export default fp(monitoringPlugin, { fastify: '>=4.x', name: 'monitoring' });

