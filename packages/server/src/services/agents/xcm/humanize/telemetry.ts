import { Counter } from 'prom-client'

import { TypedEventEmitter } from '@/services/types.js'
import { XcmMessagePayload } from '../types/index.js'

export type TelemetryEvents = {
  telemetryXcmTypeUnresolved: (message: XcmMessagePayload, version: string) => void
  telemetryXcmDecodeCallError: (chainId: string, specVersion: string) => void
  telemetryXcmInstruction: (message: XcmMessagePayload, instructionType: string) => void
}

export type TelemetryXcmHumanizerEmitter = TypedEventEmitter<TelemetryEvents>

export function xcmHumanizerMetrics(source: TelemetryXcmHumanizerEmitter) {
  const xcmTypeUnresolved = new Counter({
    name: 'oc_xcm_type_unresolved_count',
    help: 'XCM Type Unresolved',
    labelNames: ['waypoint', 'origin', 'destination', 'version'],
  })
  const xcmDecodeCallError = new Counter({
    name: 'oc_xcm_decode_call_error_count',
    help: 'XCM Decode Call Error',
    labelNames: ['chainId', 'specVersion'],
  })
  const xcmInstruction = new Counter({
    name: 'oc_xcm_instruction_count',
    help: 'XCM Instruction Type',
    labelNames: ['waypoint', 'origin', 'destination', 'instruction'],
  })

  source.on('telemetryXcmTypeUnresolved', (msg, version) => {
    xcmTypeUnresolved.labels(msg.waypoint.chainId, msg.origin.chainId, msg.destination.chainId, version).inc()
  })
  source.on('telemetryXcmDecodeCallError', (chainId, specVersion) => {
    xcmDecodeCallError.labels(chainId, specVersion).inc()
  })
  source.on('telemetryXcmInstruction', (msg, instructionType) => {
    xcmInstruction
      .labels(msg.waypoint.chainId, msg.origin.chainId, msg.destination.chainId, instructionType)
      .inc()
  })
}
