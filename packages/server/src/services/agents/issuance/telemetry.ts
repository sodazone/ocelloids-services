import { Counter } from 'prom-client'
import { TypedEventEmitter } from '@/services/types.js'

export type TelemetryEvents = {
  telemetryIssuanceStreamError: (error: { code: string; id: string }) => void
}

export type TelemetryIssuanceEventEmitter = TypedEventEmitter<TelemetryEvents>

export function issuanceAgentMetrics(source: TelemetryIssuanceEventEmitter) {
  const streamErrorCount = new Counter({
    name: 'oc_issuance_errors_count',
    help: 'Crosschain Issuance stream errors',
    labelNames: ['code', 'id'],
  })

  source.on('telemetryIssuanceStreamError', ({ code, id }) => {
    streamErrorCount.labels(code, id).inc()
  })
}
