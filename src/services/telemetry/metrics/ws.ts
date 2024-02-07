import { Counter } from 'prom-client';

import { TelemetryEventEmitter } from '../types.js';
import { notifierMetrics } from './notifiers.js';

export function wsMetrics(source: TelemetryEventEmitter) {
  notifierMetrics(source);

  const socketListenerCount = new Counter({
    name: 'xcmon_socket_listener_total',
    help: 'Socket listeners.',
    labelNames: ['type', 'subscription', 'origin', 'destinations', 'channel']
  });

  source.on('telemetrySocketListener', (ip, sub) => {
    socketListenerCount.labels(
      'websocket',
      sub.id, sub.origin, sub.destinations.join(','), ip
    ).inc();
  });
}