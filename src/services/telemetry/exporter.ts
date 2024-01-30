import { Counter, Histogram } from 'prom-client';

import {
  TelementryCatcherEvents,
  TelementryEngineEvents, TelemetryObserver, TelemetrySources
} from '../types.js';
import { XcmMessageNotify } from 'services/monitoring/types.js';

function engineExports(
  { source }: TelemetryObserver
) {
  const notifyCount = new Counter({
    name: 'xcmon_engine_notify_total',
    help: 'Matching engine notifications.',
    labelNames: ['destination', 'origin', 'outcome']
  });
  const notifyErrorCount = new Counter({
    name: 'xcmon_engine_notify_error_total',
    help: 'Matching engine notification errors.'
  });
  const events = TelementryEngineEvents;
  source.on(events.Notify,
    (message: XcmMessageNotify) => {
      notifyCount.labels(
        message.destination.chainId,
        message.origin.chainId,
        message.outcome.toString()
      ).inc();
    });
  source.on(events.NotifyError, () => {
    notifyErrorCount.inc();
  });
}

function catcherExports(
  { source }: TelemetryObserver
) {
  const timers : Record<string, () => void> = {};

  const blockSeenHist = new Histogram({
    name: 'xcmon_catcher_blocks_seen_seconds',
    help: 'Blocks seen frequencies in seconds.',
    labelNames: ['origin']
  });
  const blockFinHist = new Histogram({
    name: 'xcmon_catcher_block_finalized_seconds',
    help: 'Blocks finalized frequencies in seconds.',
    labelNames: ['origin']
  });

  const blockFinCount = new Counter({
    name: 'xcmon_catcher_blocks_finalized_total',
    help: 'Blocks finalized.',
    labelNames: ['origin']
  });
  const blockSeenCount = new Counter({
    name: 'xcmon_catcher_blocks_seen_total',
    help: 'Blocks seen.',
    labelNames: ['origin']
  });
  const blockCacheHitsCount = new Counter({
    name: 'xcmon_catcher_blocks_cache_hits_total',
    help: 'Block cache hits.',
    labelNames: ['origin']
  });

  const events = TelementryCatcherEvents;

  source.on(events.BlockCacheHit, ({ chainId }) => {
    blockCacheHitsCount.labels(chainId).inc();
  });

  source.on(events.BlockSeen, ({ chainId }) => {
    blockSeenCount.labels(
      chainId
    ).inc();

    const timerId = chainId + ':block-seen';
    const timer = timers[timerId];
    if (timer) {
      timer();
    }

    timers[timerId] = blockSeenHist.labels(
      chainId
    ).startTimer();
  });
  source.on(events.BlockFinalized, ({ chainId, header }) => {
    header;
    blockFinCount.labels(
      chainId
    ).inc();

    const timerId = chainId + ':block-fin';
    const timer = timers[timerId];
    if (timer) {
      timer();
    }

    timers[timerId] = blockFinHist.labels(
      chainId
    ).startTimer();
  });
}

const exporters = {
  [TelemetrySources.engine]: engineExports,
  [TelemetrySources.catcher]: catcherExports
};

export function collect(observer: TelemetryObserver) {
  const exporter = exporters[observer.id];
  if (exporter) {
    exporter(observer);
  }
}
