import SubstrateIngressProducer from '@/services/networking/substrate/ingress/producer.js'
import { TelemetryCollect, TelemetryEventEmitter } from '@/services/telemetry/types.js'

export interface IngressProducer extends TelemetryEventEmitter {
  start(): Promise<void>
  stop(): Promise<void>
  collectTelemetry(collect: TelemetryCollect): void
}

export type IngressProducers = {
  substrate: SubstrateIngressProducer
  // bitcoin: BitcoinProducer
}
