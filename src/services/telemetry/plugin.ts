import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { register, collectDefaultMetrics } from 'prom-client';
import { collect } from './exporters/index.js';
import { createReplyHook } from './reply-hook.js';

type TelemetryOptions = {
  telemetry: boolean
}

/**
 * Telemetry related services.
 *
 * @param fastify - The fastify instance
 * @param options - The persistence options
 */
const telemetryPlugin: FastifyPluginAsync<TelemetryOptions>
= async (fastify, options) => {
  const { log, switchboard } = fastify;

  if (options.telemetry) {
    log.info('Enable default metrics');
    collectDefaultMetrics();

    log.info('Enable switchboard metrics');
    switchboard.collectTelemetry(collect);

    fastify.addHook('onResponse', createReplyHook());

    fastify.get('/metrics', {
      schema: {
        hide: true
      }
    }, async (_, reply) => {
      reply.send(await register.metrics());
    });
  }
};

export default fp(telemetryPlugin, {
  fastify: '>=4.26.x', name: 'telemetry'
});