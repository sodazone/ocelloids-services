import { TelemetryEventEmitter } from '../types.js';
import { getOrCreateCounter } from './util.js';

export function notifierMetrics(source: TelemetryEventEmitter) {
  const notifyCount = getOrCreateCounter({
    name: 'xcmon_notifier_notification_total',
    help: 'Notifier notifications.',
    labelNames: ['type', 'subscription', 'origin', 'destination', 'outcome', 'channel']
  });
  const notifyErrorCount = getOrCreateCounter({
    name: 'xcmon_notifier_notification_error_total',
    help: 'Notifier notification errors.',
    labelNames: ['type', 'subscription', 'origin', 'destination', 'outcome', 'channel', 'error']
  });

  source.on('telemetryNotify', message => {
    notifyCount.labels(
      message.type,
      message.subscription,
      message.origin,
      message.destination,
      message.outcome,
      message.channel
    ).inc();
  });
  source.on('telemetryNotifyError',  message => {
    notifyErrorCount.labels(
      message.type,
      message.subscription,
      message.origin,
      message.destination,
      message.outcome,
      message.channel,
      message.error ?? 'unknown'
    ).inc();
  });
}