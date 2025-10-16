import { Counter, Gauge } from 'prom-client'

import { TelemetryWormholeEventEmitter } from './events.js'

export function wormholeAgentMetrics(source: TelemetryWormholeEventEmitter) {
  const errorCount = new Counter({
    name: 'oc_wormhole_errors_count',
    help: 'Wormhole errors',
    labelNames: ['code', 'id'],
  })

  const broadcastCount = new Counter({
    name: 'oc_wormhole_broadcast_total',
    help: 'Wormhole agent broadcasted messages.',
    labelNames: ['origin', 'destination', 'type'],
  })

  source.on('telemetryWormholeError', ({ code, id }) => {
    errorCount.labels(code, id).inc()
  })

  source.on('telemetryWormholeJourneyBroadcast', (msg) => {
    broadcastCount.labels(msg.origin, msg.destination, msg.type).inc()
  })
}

export function collectWormholeStats(stats: { pending: () => number }) {
  const subsGauge = new Gauge({
    name: 'oc_wormhole_pending_count',
    help: 'Pending ops.',
  })

  return async () => {
    subsGauge.set(stats.pending())
  }
}
