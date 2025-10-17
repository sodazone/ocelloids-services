import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Level } from 'level'
import { collectDefaultMetrics, register } from 'prom-client'

import { DatabaseOptions } from '@/types.js'
import { CAP_TELEMETRY } from '../auth/index.js'
import { collectDiskStats } from './metrics/disk.js'
import { collect } from './metrics/index.js'
import { collectSwitchboardStats } from './metrics/switchboard.js'
import { wsMetrics } from './metrics/ws.js'
import { createReplyHook } from './reply-hook.js'
import { PullCollector } from './types.js'

declare module 'fastify' {
  interface FastifyContextConfig {
    disableTelemetry?: boolean
  }
}

type TelemetryOptions = {
  telemetry: boolean
}

/**
 * Telemetry related services.
 *
 * @param fastify - The Fastify instance
 * @param options - The telemetry options
 */
const telemetryPlugin: FastifyPluginAsync<TelemetryOptions & DatabaseOptions> = async (fastify, options) => {
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

    const pullCollectors: PullCollector[] = []

    if (rootStore instanceof Level) {
      log.info('[metrics] enable level DB')
      pullCollectors.push(
        collectDiskStats(rootStore.location, {
          name: 'oc_root_db_disk_bytes',
          help: 'The size in bytes of the root database.',
        }),
      )
    }

    if (options.data && options.data !== ':memory:') {
      log.info('[metrics] enable data directory')
      pullCollectors.push(
        collectDiskStats(options.data, {
          name: 'oc_data_dir_disk_bytes',
          help: 'The size in bytes of the data directory.',
        }),
      )
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
      const collectors = agentService.collectTelemetry()
      if (collectors) {
        log.info('[metrics] pull collectors from agent service %s', collectors.length)
        pullCollectors.push(...collectors)
      }
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
