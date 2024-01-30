import { FastifyReply, FastifyRequest } from 'fastify';

import { Histogram } from 'prom-client';

export function replyHook() {
  const reqHist = new Histogram({
    name: 'xcmon_fastify_response_time_ms',
    help: 'Response time in milliseconds.',
    labelNames: ['status', 'method', 'route']
  });
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const millis = reply.elapsedTime;
    reqHist.labels(
      reply.statusCode.toString(),
      request.method,
      request.routeOptions.url
    ).observe(millis);
  };
}