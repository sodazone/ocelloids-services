import { NotifierHub } from '../../egress/hub.js'
import { IngressConsumer } from '../../ingress/index.js'
import IngressProducer from '../../ingress/producer/index.js'
import { HeadCatcher } from '../../ingress/watcher/head-catcher.js'
import { TelemetryEventEmitter } from '../types.js'
import { catcherMetrics } from './catcher.js'
import { ingressConsumerMetrics, ingressProducerMetrics } from './ingress.js'
import { notifierMetrics } from './notifiers.js'

function isIngressConsumer(o: TelemetryEventEmitter): o is IngressConsumer {
  return 'finalizedBlocks' in o && 'getRegistry' in o
}

export function collect(observer: TelemetryEventEmitter) {
  if (observer instanceof HeadCatcher) {
    catcherMetrics(observer)
  } else if (observer instanceof NotifierHub) {
    notifierMetrics(observer)
  } else if (observer instanceof IngressProducer) {
    ingressProducerMetrics(observer)
  } else if (isIngressConsumer(observer)) {
    ingressConsumerMetrics(observer)
  }
}
