import {
  TelemetryObserver, TelemetrySources
} from '../../types.js';
import { catcherExports } from './catcher.js';

import { engineExports } from './engine.js';

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