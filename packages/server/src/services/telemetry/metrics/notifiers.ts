import { TelemetryEventEmitter } from '../types.js'
import { getOrCreateCounter } from './util.js'

export function notifierMetrics(source: TelemetryEventEmitter) {
  const notifyCount = getOrCreateCounter({
    name: 'oc_notifier_notification_total',
    help: 'Notifier notifications.',
    labelNames: ['type', 'subscription', 'agent', 'channel'],
  })
  const notifyErrorCount = getOrCreateCounter({
    name: 'oc_notifier_notification_error_total',
    help: 'Notifier notification errors.',
    labelNames: ['type', 'subscription', 'agent', 'channel'],
  })

  source.on('telemetryNotify', (message) => {
    notifyCount.labels(message.type, message.subscription, message.agent, message.channel).inc()
  })
  source.on('telemetryNotifyError', (message) => {
    notifyErrorCount.labels(message.type, message.subscription, message.agent, message.channel).inc()
  })
}
