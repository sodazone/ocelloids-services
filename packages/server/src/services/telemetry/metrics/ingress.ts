import { Counter } from 'prom-client';

import { TelemetryEventEmitter } from '../types.js';

export function ingressConsumerMetrics(source: TelemetryEventEmitter) {
  const consumerErrors = new Counter({
    name: 'oc_ingress_consumer_errors_count',
    help: 'Ingress consumer errors',
    labelNames: ['id', 'severity'],
  });

  source.on('telemetryIngressConsumerError', (id, severity) => {
    consumerErrors.labels(id, severity ?? 'error').inc();
  });
}

export function ingressProducerMetrics(source: TelemetryEventEmitter) {
  const producerErrors = new Counter({
    name: 'oc_ingress_producer_errors_count',
    help: 'Ingress producer errors',
    labelNames: ['id', 'severity'],
  });

  source.on('telemetryIngressProducerError', (id, severity = 'error') => {
    producerErrors.labels(id, severity).inc();
  });
}
