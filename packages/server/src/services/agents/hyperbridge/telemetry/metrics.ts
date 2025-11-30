import { Counter } from 'prom-client'

import { TelemetryHyperbridgeEventEmitter } from './events.js'

export function hyperbridgeAgentMetrics(source: TelemetryHyperbridgeEventEmitter) {
  const errorCount = new Counter({
    name: 'oc_hyperbridge_errors_count',
    help: 'Wormhole errors',
    labelNames: ['code', 'id'],
  })

  source.on('telemetryHyperbridgeError', ({ code, id }) => {
    errorCount.labels(code, id).inc()
  })
}

export function hyperbridgeMatchingEngineMetrics(source: TelemetryHyperbridgeEventEmitter) {
  const outboundCount = new Counter({
    name: 'oc_ismp_outbound_total',
    help: 'Hyperbridge agent ISMP outbound messages.',
    labelNames: ['origin', 'destination', 'outcome'],
  })
  const receivedCount = new Counter({
    name: 'oc_ismp_received_total',
    help: 'Hyperbridge agent ISMP received messages.',
    labelNames: ['origin', 'destination', 'outcome'],
  })
  const relayCount = new Counter({
    name: 'oc_ismp_relay_total',
    help: 'Hyperbridge agent ISMP relay messages.',
    labelNames: ['origin', 'destination', 'outcome'],
  })
  const timeoutCount = new Counter({
    name: 'oc_ismp_timeout_total',
    help: 'Hyperbridge agent ISMP timeout messages.',
    labelNames: ['origin', 'destination'],
  })
  const unmatchedCount = new Counter({
    name: 'oc_ismp_unmatched_total',
    help: 'Hyperbridge agent ISMP unmatched messages.',
    labelNames: ['origin', 'destination'],
  })
  const janitorScheduledCount = new Counter({
    name: 'oc_hyperbridge_janitor_scheduled_total',
    help: 'Hyperbridge matching engine janitor tasks scheduled.',
    labelNames: ['sublevel'],
  })
  const janitorSweptCount = new Counter({
    name: 'oc_hyperbridge_janitor_swept_total',
    help: 'Hyperbridge matching engine janitor tasks swept.',
    labelNames: ['sublevel'],
  })

  source.on('telemetryIsmpOutbound', ({ origin, destination }) => {
    outboundCount.labels(origin.chainId, destination.chainId, origin.outcome).inc()
  })
  source.on('telemetryIsmpRelayed', ({ origin, destination, waypoint }) => {
    relayCount.labels(origin.chainId, destination.chainId, waypoint.outcome).inc()
  })
  source.on('telemetryIsmpReceived', ({ origin, destination, waypoint }) => {
    receivedCount.labels(origin.chainId, destination.chainId, waypoint.outcome).inc()
  })
  source.on('telemetryIsmpTimeout', ({ origin, destination }) => {
    timeoutCount.labels(origin.chainId, destination.chainId).inc()
  })
  source.on('telemetryHyperbridgeUnmatched', ({ origin, destination }) => {
    unmatchedCount.labels(origin.chainId, destination.chainId).inc()
  })
  source.on('telemetryHyperbridgeJanitorScheduled', ({ sublevel }) => {
    janitorScheduledCount.labels(sublevel)
  })
  source.on('telemetryHyperbridgeJanitorSwept', ({ sublevel }) => {
    janitorSweptCount.labels(sublevel)
  })
}
