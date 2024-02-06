import { Counter } from 'prom-client';
import { TelemetryEventEmitter } from '../types.js';

export function notifierMetrics(source: TelemetryEventEmitter) {
  const notifyCount = new Counter({
    name: 'xcmon_notifier_notification_total',
    help: 'Notifier notifications.',
    labelNames: ['type', 'subscription', 'origin', 'destination', 'outcome', 'sink']
  });
  const notifyErrorCount = new Counter({
    name: 'xcmon_notifier_notification_error_total',
    help: 'Notifier notification errors.',
    labelNames: ['type', 'subscription', 'origin', 'destination', 'outcome', 'sink', 'error']
  });

  source.on('notify', message => {
    notifyCount.labels(
      ...Object.values<string>(message)
    ).inc();
  });
  source.on('notifyError',  message => {
    notifyErrorCount.labels(
      ...Object.values<string>(message)
    ).inc();
  });
}