import {
  TelemetryObserver, TelemetrySources
} from '../../types.js';

import { catcherMetrics } from './catcher.js';
import { engineMetrics } from './engine.js';
import { notifierMetrics } from './notifiers.js';

const metrics = {
  [TelemetrySources.engine]: engineMetrics,
  [TelemetrySources.catcher]: catcherMetrics,
  [TelemetrySources.notifier]: notifierMetrics
};

export function collect(observer: TelemetryObserver) {
  const exporter = metrics[observer.id];
  if (exporter) {
    exporter(observer);
  }
}