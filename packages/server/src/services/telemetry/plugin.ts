import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Level } from 'level'
import { collectDefaultMetrics, register } from 'prom-client'

import { collectDiskStats } from './metrics/disk.js'
import { collect } from './metrics/index.js'
import { collectSwitchboardStats } from './metrics/switchboard.js'
import { wsMetrics } from './metrics/ws.js'
import { createReplyHook } from './reply-hook.js'

declare module 'fastify' {
  interface FastifyContextConfig {
    disableTelemetry?: boolean
  }
}

type TelemetryOptions = {
  telemetry: boolean
}

type PullCollect = () => Promise<void>

/**
 * Telemetry related services.
 *
 * @param fastify - The fastify instance
 * @param options - The telemetry options
 */
const telemetryPlugin: FastifyPluginAsync<TelemetryOptions> = async (fastify, options) => {
  const { log, switchboard, wsProtocol, rootStore, ingressConsumer, ingressProducer } = fastify

  if (options.telemetry) {
    log.info('Enable default metrics')
    collectDefaultMetrics()

    const pullCollectors: PullCollect[] = []

    if (rootStore instanceof Level) {
      log.info('Enable level DB metrics')
      pullCollectors.push(collectDiskStats(rootStore.location))
    }

    if (switchboard) {
      log.info('Enable switchboard metrics')
      pullCollectors.push(collectSwitchboardStats(switchboard))
      switchboard.collectTelemetry(collect)
    }

    if (wsProtocol) {
      log.info('Enable websocket subscription metrics')
      wsMetrics(wsProtocol)
    }

    if (ingressConsumer) {
      log.info('Enable ingress consumer metrics')
      ingressConsumer.collectTelemetry(collect)
    }

    if (ingressProducer) {
      log.info('Enable ingress producer metrics')
      ingressProducer.collectTelemetry(collect)
    }

    fastify.addHook('onResponse', createReplyHook())

    fastify.get(
      '/metrics',
      {
        schema: {
          hide: true,
        },
        config: {
          disableTelemetry: true,
        },
      },
      async (_, reply) => {
        if (pullCollectors.length > 0) {
          await Promise.all(pullCollectors.map((c) => c()))
        }

        reply.send(await register.metrics())
      }
    )
  }
}

export default fp(telemetryPlugin, {
  fastify: '>=4.26.x',
  name: 'telemetry',
})
