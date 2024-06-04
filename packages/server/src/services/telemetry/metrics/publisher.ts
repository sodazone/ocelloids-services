import { TelemetryEventEmitter } from '../types.js'
import { getOrCreateCounter } from './util.js'

export function notifierMetrics(source: TelemetryEventEmitter) {
  const messageCount = getOrCreateCounter({
    name: 'oc_publisher_msgs_total',
    help: 'Publisher messages.',
    labelNames: ['type', 'subscription', 'agent', 'channel'],
  })
  const messageErrorCount = getOrCreateCounter({
    name: 'oc_publisher_msgs_error_total',
    help: 'Publisher message delivery errors.',
    labelNames: ['type', 'subscription', 'agent', 'channel'],
  })

  source.on('telemetryPublish', (message) => {
    messageCount.labels(message.type, message.subscription, message.agent, message.channel).inc()
  })
  source.on('telemetryPublishError', (message) => {
    messageErrorCount.labels(message.type, message.subscription, message.agent, message.channel).inc()
  })
}
