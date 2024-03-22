import { Counter } from 'prom-client';

import { XcmHop, XcmInbound, XcmRelayed, XcmSent, XcmTimeout } from '../../monitoring/types.js';
import { TelemetryEventEmitter } from '../types.js';

export function engineMetrics(source: TelemetryEventEmitter) {
  const inCount = new Counter({
    name: 'oc_engine_in_total',
    help: 'Matching engine inbound messages.',
    labelNames: ['subscription', 'origin', 'outcome'],
  });
  const outCount = new Counter({
    name: 'oc_engine_out_total',
    help: 'Matching engine outbound messages.',
    labelNames: ['subscription', 'origin', 'destination'],
  });
  const matchCount = new Counter({
    name: 'oc_engine_matched_total',
    help: 'Matching engine matched messages.',
    labelNames: ['subscription', 'origin', 'destination', 'outcome'],
  });
  const trapCount = new Counter({
    name: 'oc_engine_trapped_total',
    help: 'Matching engine matched messages with trapped assets.',
    labelNames: ['subscription', 'origin', 'destination', 'outcome'],
  });
  const relayCount = new Counter({
    name: 'oc_engine_relayed_total',
    help: 'Matching engine relayed messages.',
    labelNames: ['subscription', 'origin', 'destination', 'legIndex', 'outcome'],
  });
  const timeoutCount = new Counter({
    name: 'oc_engine_timeout_total',
    help: 'Matching engine sent timeout messages.',
    labelNames: ['subscription', 'origin', 'destination'],
  });
  const hopCount = new Counter({
    name: 'oc_engine_hop_total',
    help: 'Matching engine hop messages.',
    labelNames: ['subscription', 'origin', 'destination', 'legIndex', 'stop', 'outcome'],
  });

  source.on('telemetryInbound', (message: XcmInbound) => {
    inCount.labels(message.subscriptionId, message.chainId, message.outcome.toString()).inc();
  });

  source.on('telemetryOutbound', (message: XcmSent) => {
    outCount.labels(message.subscriptionId, message.origin.chainId, message.destination.chainId).inc();
  });

  source.on('telemetryMatched', (inMsg: XcmInbound, outMsg: XcmSent) => {
    matchCount
      .labels(outMsg.subscriptionId, outMsg.origin.chainId, outMsg.destination.chainId, inMsg.outcome.toString())
      .inc();

    if (inMsg.assetsTrapped !== undefined) {
      trapCount
        .labels(outMsg.subscriptionId, outMsg.origin.chainId, outMsg.destination.chainId, inMsg.outcome.toString())
        .inc();
    }
  });

  source.on('telemetryRelayed', (relayMsg: XcmRelayed) => {
    relayCount
      .labels(
        relayMsg.subscriptionId,
        relayMsg.origin.chainId,
        relayMsg.destination.chainId,
        relayMsg.waypoint.legIndex.toString(),
        relayMsg.waypoint.outcome.toString()
      )
      .inc();
  });

  source.on('telemetryTimeout', (msg: XcmTimeout) => {
    timeoutCount.labels(msg.subscriptionId, msg.origin.chainId, msg.destination.chainId).inc();
  });

  source.on('telemetryHop', (msg: XcmHop) => {
    hopCount
      .labels(
        msg.subscriptionId,
        msg.origin.chainId,
        msg.destination.chainId,
        msg.waypoint.legIndex.toString(),
        msg.waypoint.chainId,
        msg.waypoint.outcome.toString()
      )
      .inc();
  });
}
