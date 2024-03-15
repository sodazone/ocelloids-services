import { TelemetryEventEmitter } from '../types.js';
import { ingressMetrics } from './ingress.js';
import { catcherMetrics } from './catcher.js';
import { engineMetrics } from './engine.js';
import { notifierMetrics } from './notifiers.js';
import { IngressConsumer } from '../../ingress/index.js';
import { NotifierHub } from '../../notification/hub.js';
import { MatchingEngine } from '../../monitoring/matching.js';
import { Switchboard } from '../../monitoring/switchboard.js';
import { switchboardMetrics } from './switchboard.js';
import { HeadCatcher } from '../../ingress/watcher/head-catcher.js';

function isIngressConsumer(o: TelemetryEventEmitter): o is IngressConsumer {
  return 'finalizedBlocks' in o && 'getRegistry' in o;
}

export function collect(observer: TelemetryEventEmitter) {
  if (observer instanceof Switchboard) {
    switchboardMetrics(observer);
  } else if (observer instanceof MatchingEngine) {
    engineMetrics(observer);
  } else if (observer instanceof HeadCatcher) {
    catcherMetrics(observer);
  } else if (isIngressConsumer(observer)) {
    ingressMetrics(observer);
  } else if (observer instanceof NotifierHub) {
    notifierMetrics(observer);
  }
}
