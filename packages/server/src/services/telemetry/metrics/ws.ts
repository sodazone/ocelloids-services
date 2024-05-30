import { Gauge } from 'prom-client'

import { TelemetryEventEmitter } from '../types.js'
import { notifierMetrics } from './notifiers.js'

export function wsMetrics(source: TelemetryEventEmitter) {
  notifierMetrics(source)

  const socketListenerCount = new Gauge({
    name: 'oc_socket_listener_count',
    help: 'Socket listeners.',
    labelNames: ['type', 'subscription', 'agent', 'ip'],
  })

  source.on('telemetrySocketListener', (ip, sub, close = false) => {
    const gauge = socketListenerCount.labels('websocket', sub.id, sub.agent, ip)
    if (close) {
      gauge.dec()
    } else {
      gauge.inc()
    }
  })
}
