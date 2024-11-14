import { Egress } from '@/services/egress/hub.js'
import IngressProducer from '@/services/networking/substrate/ingress/producer.js'
import { SubstrateIngressConsumer } from '@/services/networking/substrate/ingress/types.js'
import { SubstrateWatcher } from '@/services/networking/substrate/watcher/watcher.js'
import { TelemetryEventEmitter } from '../types.js'
import { catcherMetrics } from './catcher.js'
import { ingressConsumerMetrics, ingressProducerMetrics } from './ingress.js'
import { egressMetrics } from './publisher.js'

function isIngressConsumer(o: TelemetryEventEmitter): o is SubstrateIngressConsumer {
  return 'finalizedBlocks' in o && 'getRegistry' in o
}

export function collect(observer: TelemetryEventEmitter) {
  if (observer instanceof SubstrateWatcher) {
    catcherMetrics(observer)
  } else if (observer instanceof Egress) {
    egressMetrics(observer)
  } else if (observer instanceof IngressProducer) {
    ingressProducerMetrics(observer)
  } else if (isIngressConsumer(observer)) {
    ingressConsumerMetrics(observer)
  }
}
