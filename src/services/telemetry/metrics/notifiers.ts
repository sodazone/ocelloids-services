import { Counter } from 'prom-client';

import {
  TelementryNotifierEvents as events, TelemetryObserver
} from '../../types.js';

export function notifierMetrics(
  { source }: TelemetryObserver
) {
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

  source.on(events.Notify, message => {
    notifyCount.labels(
      ...Object.values<string>(message)
    ).inc();
  });
  source.on(events.NotifyError,  message => {
    notifyErrorCount.labels(
      ...Object.values<string>(message)
    ).inc();
  });
}