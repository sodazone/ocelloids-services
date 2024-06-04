import { TelemetryEventEmitter } from '../types.js'
import { getOrCreateCounter } from './util.js'

export function egressMetrics(source: TelemetryEventEmitter) {
  const messageCount = getOrCreateCounter({
    name: 'oc_egress_msgs_total',
    help: 'Egress messages.',
    labelNames: ['type', 'subscription', 'agent', 'channel'],
  })
  const messageErrorCount = getOrCreateCounter({
    name: 'oc_egress_errors_total',
    help: 'Egress errors.',
    labelNames: ['type', 'subscription', 'agent', 'channel'],
  })

  source.on('telemetryPublish', (message) => {
    messageCount.labels(message.type, message.subscription, message.agent, message.channel).inc()
  })
  source.on('telemetryPublishError', (message) => {
    messageErrorCount.labels(message.type, message.subscription, message.agent, message.channel).inc()
  })
}
