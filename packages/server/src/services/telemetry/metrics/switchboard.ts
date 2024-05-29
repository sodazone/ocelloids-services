import { Gauge } from 'prom-client'

import { Switchboard } from '../../subscriptions/switchboard.js'

export function collectSwitchboardStats(switchboard: Switchboard) {
  const subsGauge = new Gauge({
    name: 'oc_active_subscriptions_count',
    help: 'Active subscriptions.',
    labelNames: ['type'],
  })

  return async () => {
    const { stats } = switchboard
    subsGauge.labels('ephemeral').set(stats.ephemeral)
    subsGauge.labels('persistent').set(stats.persistent)
  }
}
