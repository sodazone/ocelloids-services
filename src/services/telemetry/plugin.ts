import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Level } from 'level';
import { register, collectDefaultMetrics } from 'prom-client';

import { collect } from './metrics/index.js';
import { createReplyHook } from './reply-hook.js';
import { collectDiskStats } from './metrics/disk.js';
import { wsMetrics } from './metrics/ws.js';
import { collectSwitchboardStats } from './metrics/switchboard.js';

declare module 'fastify' {
  interface FastifyContextConfig {
    disableTelemetry?: boolean
  }
}

type TelemetryOptions = {
  telemetry: boolean
}

type PullCollect = () => Promise<void>;

/**
 * Telemetry related services.
 *
 * @param fastify - The fastify instance
 * @param options - The telemetry options
 */
const telemetryPlugin: FastifyPluginAsync<TelemetryOptions>
= async (fastify, options) => {
  const {
    log, switchboard, wsProtocol, storage: { root }
  } = fastify;

  if (options.telemetry) {
    log.info('Enable default metrics');
    collectDefaultMetrics();

    const pullCollectors : PullCollect[] = [];

    if (root instanceof Level) {
      log.info('Enable level DB metrics');
      pullCollectors.push(collectDiskStats(root.location));
    }

    log.info('Enable switchboard metrics');
    switchboard.collectTelemetry(collect);
    pullCollectors.push(collectSwitchboardStats(switchboard));

    log.info('Enable websocket subscription metrics');
    wsMetrics(wsProtocol);

    fastify.addHook('onResponse', createReplyHook());

    fastify.get('/metrics', {
      schema: {
        hide: true
      },
      config: {
        disableTelemetry: true
      }
    }, async (_, reply) => {
      if (pullCollectors.length > 0) {
        await Promise.all(
          pullCollectors.map(c => c())
        );
      }

      reply.send(await register.metrics());
    });
  }
};

export default fp(telemetryPlugin, {
  fastify: '>=4.26.x', name: 'telemetry'
});