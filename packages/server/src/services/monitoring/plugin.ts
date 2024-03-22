import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { Switchboard, SwitchboardOptions } from './switchboard.js';
import { SubscriptionApi } from './api/index.js';
import WebsocketProtocolPlugin, { WebsocketProtocolOptions } from './api/ws/plugin.js';
import { SubsStore } from '../persistence/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    switchboard: Switchboard;
    subsStore: SubsStore;
  }
}

type MonitoringOptions = SwitchboardOptions & WebsocketProtocolOptions;

/**
 * Monitoring service Fastify plugin.
 *
 * Exposes the subscription HTTP API and starts the switchboard.
 *
 * @param {FastifyInstance} fastify The Fastify instance.
 */
const monitoringPlugin: FastifyPluginAsync<MonitoringOptions> = async (fastify, options) => {
  const { log } = fastify;

  const subsStore = new SubsStore(fastify.log, fastify.rootStore, fastify.ingressConsumer);
  fastify.decorate('subsStore', subsStore);

  const switchboard = new Switchboard(fastify, options);

  fastify.decorate('switchboard', switchboard);
  await switchboard.start();

  fastify.addHook('onClose', async () => {
    log.info('Shutting down monitoring service');

    await switchboard.stop();
  });

  await fastify.register(SubscriptionApi);
  await fastify.register(WebsocketProtocolPlugin, options);
};

export default fp(monitoringPlugin, { fastify: '>=4.x', name: 'monitoring' });
