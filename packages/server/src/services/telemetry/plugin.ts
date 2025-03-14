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
    log.info('[metrics] enable default')
    collectDefaultMetrics()

    const pullCollectors: PullCollect[] = []

    if (rootStore instanceof Level) {
      log.info('[metrics] enable level DB')
      pullCollectors.push(collectDiskStats(rootStore.location))
    }

    if (switchboard) {
      log.info('[metrics] enable switchboard')
      pullCollectors.push(collectSwitchboardStats(switchboard))
      switchboard.collectTelemetry(collect)
    }

    if (wsProtocol) {
      log.info('[metrics] enable websocket subscription')
      wsMetrics(wsProtocol)
    }

    if (ingress) {
      log.info('[metrics] enable ingress consumer')
      for (const consumer of Object.values(ingress)) {
        consumer.collectTelemetry(collect)
      }
    }

    if (ingressProducers) {
      log.info('[metrics] enable ingress producer')
      for (const producer of Object.values(ingressProducers)) {
        producer.collectTelemetry(collect)
      }
    }

    if (agentService) {
      log.info('[metrics] enable agent')
      agentService.collectTelemetry()
    }

    fastify.addHook('onResponse', createReplyHook())

    /* c8 ignore next */
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
