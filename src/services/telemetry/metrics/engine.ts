import { Counter } from 'prom-client';

import { XcmReceived, XcmSent } from '../../monitoring/types.js';
import { TelemetryEventEmitter } from '../types.js';

export function engineMetrics(source: TelemetryEventEmitter) {
  const inCount = new Counter({
    name: 'xcmon_engine_in_total',
    help: 'Matching engine inbound messages.',
    labelNames: ['subscription', 'origin', 'outcome']
  });
  const outCount = new Counter({
    name: 'xcmon_engine_out_total',
    help: 'Matching engine outbound messages.',
    labelNames: ['subscription', 'origin', 'destination']
  });
  const matchCount = new Counter({
    name: 'xcmon_engine_matched_total',
    help: 'Matching engine matched messages.',
    labelNames: ['subscription', 'origin', 'destination', 'outcome']
  });

  source.on('telemetryInbound',
    (message: XcmReceived) => {
      inCount.labels(
        message.subscriptionId,
        message.chainId,
        message.outcome.toString()
      ).inc();
    });

  source.on('telemetryOutbound',
    (message: XcmSent) => {
      outCount.labels(
        message.subscriptionId,
        message.origin.chainId,
        message.destination.chainId
      ).inc();
    });

  source.on('telemetryMatched',
    (inMsg: XcmReceived, outMsg: XcmSent) => {
      matchCount.labels(
        outMsg.subscriptionId,
        outMsg.origin.chainId,
        outMsg.destination.chainId,
        inMsg.outcome.toString()
      ).inc();
    });
}