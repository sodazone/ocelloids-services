import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Level } from 'level'
import { collectDefaultMetrics, register } from 'prom-client'

import { CAP_TELEMETRY } from '../auth/index.js'
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
 * @param fastify - The Fastify instance
 * @param options - The telemetry options
 */
const telemetryPlugin: FastifyPluginAsync<TelemetryOptions> = async (fastify, options) => {
  const {
    log,
    switchboard,
    wsProtocol,
    levelDB: rootStore,
    ingress,
    ingressProducers,
    agentCatalog: agentService,
  } = fastify

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

    if (ingress) {
      log.info('Enable ingress consumer metrics')
      for (const consumer of Object.values(ingress)) {
        consumer.collectTelemetry(collect)
      }
    }

    if (ingressProducers) {
      log.info('Enable ingress producer metrics')
      for (const producer of Object.values(ingressProducers)) {
        producer.collectTelemetry(collect)
      }
    }

    if (agentService) {
      log.info('Enable agent metrics')
      agentService.collectTelemetry()
    }

    fastify.addHook('onResponse', createReplyHook())

    /* istanbul ignore next */
    fastify.get(
      '/metrics',
      {
        schema: {
          hide: true,
        },
        config: {
          caps: [CAP_TELEMETRY],
          disableTelemetry: true,
        },
      },
      async (_, reply) => {
        if (pullCollectors.length > 0) {
          await Promise.all(pullCollectors.map((c) => c()))
        }

        reply.send(await register.metrics())
      },
    )
  }
}

export default fp(telemetryPlugin, {
  fastify: '>=4.26.x',
  name: 'telemetry',
})
