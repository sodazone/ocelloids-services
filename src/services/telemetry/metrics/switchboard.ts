import { Counter, Gauge } from 'prom-client';

import { Switchboard } from '../../monitoring/switchboard.js';

export function switchboardMetrics(switchboard: Switchboard) {
  const subsErrors = new Counter({
    name: 'xcmon_subscription_errors_count',
    help: 'Subscription errors',
    labelNames: ['id', 'chainId', 'direction']
  });

  switchboard.on('telemetrySubscriptionError', msg => {
    subsErrors.labels(
      msg.subscriptionId, msg.chainId, msg.direction
    ).inc();
  });
}

export function collectSwitchboardStats(switchboard: Switchboard) {
  const subsGauge = new Gauge({
    name: 'xcmon_active_subscriptions_count',
    help: 'Active subscriptions.',
    labelNames: ['type']
  });

  return async () => {
    const { stats } = switchboard;
    subsGauge.labels('ephemeral').set(stats.ephemeral);
    subsGauge.labels('persistent').set(stats.persistent);
  };
}