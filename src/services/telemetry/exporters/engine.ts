import { Counter } from 'prom-client';

import {
  TelementryEngineEvents, TelemetryObserver
} from '../../types.js';
import { XcmMessageNotify } from '../../monitoring/types.js';

export function engineExports(
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