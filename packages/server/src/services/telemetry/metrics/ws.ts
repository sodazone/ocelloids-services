import { Gauge } from 'prom-client';

import { TelemetryEventEmitter } from '../types.js';
import { notifierMetrics } from './notifiers.js';

export function wsMetrics(source: TelemetryEventEmitter) {
  notifierMetrics(source);

  const socketListenerCount = new Gauge({
    name: 'OC_socket_listener_count',
    help: 'Socket listeners.',
    labelNames: ['type', 'subscription', 'origin', 'destinations', 'channel'],
  });

  source.on('telemetrySocketListener', (ip, sub, close = false) => {
    const gauge = socketListenerCount.labels('websocket', sub.id, sub.origin, sub.destinations.join(','), ip);
    if (close) {
      gauge.dec();
    } else {
      gauge.inc();
    }
  });
}
