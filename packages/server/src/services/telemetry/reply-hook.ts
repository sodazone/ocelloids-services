import { FastifyReply, FastifyRequest } from 'fastify'

import { Histogram } from 'prom-client'

const NO_ROUTE_STATUS = [401, 404]

export function createReplyHook() {
  const reqHist = new Histogram({
    name: 'oc_fastify_response_time_ms',
    help: 'HTTP response time in milliseconds.',
    labelNames: ['status', 'method', 'route'],
  })
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.routeOptions.config.disableTelemetry) {
      return
    }

    const { statusCode, elapsedTime } = reply

    // only add route labels for non 401 or 404 status
    if (NO_ROUTE_STATUS.includes(reply.statusCode)) {
      reqHist.labels(statusCode.toString(), request.method, '-').observe(elapsedTime)
    } else {
      reqHist
        .labels(statusCode.toString(), request.method, request.routeOptions.url ?? '-')
        .observe(elapsedTime)
    }
  }
}
