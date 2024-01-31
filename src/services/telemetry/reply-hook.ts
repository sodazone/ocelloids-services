import { FastifyReply, FastifyRequest } from 'fastify';

import { Histogram } from 'prom-client';

export function createReplyHook() {
  const reqHist = new Histogram({
    name: 'xcmon_fastify_response_time_ms',
    help: 'HTTP response time in milliseconds.',
    labelNames: ['status', 'method', 'route']
  });
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.routeConfig.disableTelemetry) {
      return;
    }

    const millis = reply.elapsedTime;
    reqHist.labels(
      reply.statusCode.toString(),
      request.method,
      request.routeOptions.url
    ).observe(millis);
  };
}