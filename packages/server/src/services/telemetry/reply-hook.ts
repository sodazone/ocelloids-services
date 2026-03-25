import { FastifyReply, FastifyRequest } from 'fastify'

import { Histogram } from 'prom-client'

const NO_ROUTE_STATUS = [401, 404]

export function createReplyHook() {
  const reqHist = new Histogram({
    name: 'oc_fastify_response_time_seconds',
    help: 'HTTP response time in seconds.',
    labelNames: ['status', 'method', 'route'],
  })
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.routeOptions.config.disableTelemetry) {
      return
    }

    const { statusCode, elapsedTime } = reply

    const durationSeconds = elapsedTime / 1000

    // only add route labels for non 401 or 404 status
    const route = NO_ROUTE_STATUS.includes(statusCode) ? '-' : (request.routeOptions.url ?? '-')

    reqHist.labels(statusCode.toString(), request.method, route).observe(durationSeconds)
  }
}
