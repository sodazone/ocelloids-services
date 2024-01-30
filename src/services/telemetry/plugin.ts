import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { register, collectDefaultMetrics } from 'prom-client';
import { collect } from './exporter.js';
import { replyHook as createReplyHook } from './reply-hook.js';

const telemetryPlugin: FastifyPluginAsync = async api => {
  const { log, switchboard } = api;

  log.info('Enable default metrics');
  collectDefaultMetrics();

  log.info('Enable switchboard metrics');
  switchboard.collectTelemetry(collect);

  api.addHook('onResponse', createReplyHook());

  api.get('/metrics', {
    schema: {
      hide: true
    }
  }, async (_, reply) => {
    reply.send(await register.metrics());
  });
};

export default fp(telemetryPlugin, {
  fastify: '>=4.26.x', name: 'telemetry'
});