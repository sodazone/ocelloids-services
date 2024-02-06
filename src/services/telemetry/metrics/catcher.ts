import { Counter, Histogram } from 'prom-client';
import { TelemetryEventEmitter } from '../types.js';

export function catcherMetrics(source: TelemetryEventEmitter) {
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

  source.on('blockCacheHit', ({ chainId }) => {
    blockCacheHitsCount.labels(chainId).inc();
  });

  source.on('blockSeen', ({ chainId }) => {
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
  source.on('blockFinalized', ({ chainId }) => {
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

