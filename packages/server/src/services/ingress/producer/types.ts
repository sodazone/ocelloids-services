import { TelemetryCollect, TelemetryEventEmitter } from '@/services/telemetry/types.js'

export interface IngressProducer extends TelemetryEventEmitter {
  start(): Promise<void>
  stop(): Promise<void>
  collectTelemetry(collect: TelemetryCollect): void
}
