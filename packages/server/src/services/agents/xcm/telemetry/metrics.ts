import { Counter } from 'prom-client'

import { XcmBridge, XcmHop, XcmInbound, XcmRelayed, XcmSent, XcmTimeout } from '../types.js'
import { TelemetryXcmEventEmitter } from './events.js'

export function xcmAgentMetrics(source: TelemetryXcmEventEmitter) {
  const subsErrors = new Counter({
    name: 'oc_xcm_subscription_errors_count',
    help: 'Subscription errors',
    labelNames: ['id', 'chainId', 'direction'],
  })

  source.on('telemetryXcmSubscriptionError', (msg) => {
    subsErrors.labels(msg.subscriptionId, msg.chainId, msg.direction).inc()
  })
}

export function xcmMatchingEngineMetrics(source: TelemetryXcmEventEmitter) {
  const inCount = new Counter({
    name: 'oc_xcm_engine_in_total',
    help: 'Matching engine inbound messages.',
    labelNames: ['subscription', 'origin', 'outcome'],
  })
  const outCount = new Counter({
    name: 'oc_xcm_engine_out_total',
    help: 'Matching engine outbound messages.',
    labelNames: ['subscription', 'origin', 'destination'],
  })
  const matchCount = new Counter({
    name: 'oc_xcm_engine_matched_total',
    help: 'Matching engine matched messages.',
    labelNames: ['subscription', 'origin', 'destination', 'outcome'],
  })
  const trapCount = new Counter({
    name: 'oc_xcm_engine_trapped_total',
    help: 'Matching engine matched messages with trapped assets.',
    labelNames: ['subscription', 'origin', 'destination', 'outcome'],
  })
  const relayCount = new Counter({
    name: 'oc_xcm_engine_relayed_total',
    help: 'Matching engine relayed messages.',
    labelNames: ['subscription', 'origin', 'destination', 'legIndex', 'outcome'],
  })
  const timeoutCount = new Counter({
    name: 'oc_xcm_engine_timeout_total',
    help: 'Matching engine sent timeout messages.',
    labelNames: ['subscription', 'origin', 'destination'],
  })
  const hopCount = new Counter({
    name: 'oc_xcm_engine_hop_total',
    help: 'Matching engine hop messages.',
    labelNames: ['subscription', 'origin', 'destination', 'legIndex', 'stop', 'outcome', 'direction'],
  })
  const bridgeCount = new Counter({
    name: 'oc_xcm_engine_bridge_total',
    help: 'Matching engine bridge messages.',
    labelNames: ['subscription', 'origin', 'destination', 'legIndex', 'stop', 'outcome', 'direction'],
  })

  source.on('telemetryXcmInbound', (message: XcmInbound) => {
    inCount.labels(message.subscriptionId, message.chainId, message.outcome.toString()).inc()
  })

  source.on('telemetryXcmOutbound', (message: XcmSent) => {
    outCount.labels(message.subscriptionId, message.origin.chainId, message.destination.chainId).inc()
  })

  source.on('telemetryXcmMatched', (inMsg: XcmInbound, outMsg: XcmSent) => {
    matchCount
      .labels(
        outMsg.subscriptionId,
        outMsg.origin.chainId,
        outMsg.destination.chainId,
        inMsg.outcome.toString(),
      )
      .inc()
  })

  source.on('telemetryXcmRelayed', (relayMsg: XcmRelayed) => {
    relayCount
      .labels(
        relayMsg.subscriptionId,
        relayMsg.origin.chainId,
        relayMsg.destination.chainId,
        relayMsg.waypoint.legIndex.toString(),
        relayMsg.waypoint.outcome.toString(),
      )
      .inc()
  })

  source.on('telemetryXcmTimeout', (msg: XcmTimeout) => {
    timeoutCount.labels(msg.subscriptionId, msg.origin.chainId, msg.destination.chainId).inc()
  })

  source.on('telemetryXcmHop', (msg: XcmHop) => {
    hopCount
      .labels(
        msg.subscriptionId,
        msg.origin.chainId,
        msg.destination.chainId,
        msg.waypoint.legIndex.toString(),
        msg.waypoint.chainId,
        msg.waypoint.outcome.toString(),
        msg.direction,
      )
      .inc()
  })

  source.on('telemetryXcmBridge', (msg: XcmBridge) => {
    bridgeCount
      .labels(
        msg.subscriptionId,
        msg.origin.chainId,
        msg.destination.chainId,
        msg.waypoint.legIndex.toString(),
        msg.waypoint.chainId,
        msg.waypoint.outcome.toString(),
        msg.bridgeMessageType,
      )
      .inc()
  })

  source.on('telemetryXcmTrapped', (inMsg: XcmInbound, outMsg: XcmSent) => {
    trapCount
      .labels(
        outMsg.subscriptionId,
        outMsg.origin.chainId,
        outMsg.destination.chainId,
        inMsg.outcome.toString(),
      )
      .inc()
  })
}
