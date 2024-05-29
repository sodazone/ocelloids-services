import { TypedEventEmitter } from '../../../types.js'
import { XcmBridge, XcmHop, XcmInbound, XcmRelayed, XcmSent, XcmTimeout } from '../types.js'

export type TelemetryEvents = {
  telemetryInbound: (message: XcmInbound) => void
  telemetryOutbound: (message: XcmSent) => void
  telemetryRelayed: (relayMsg: XcmRelayed) => void
  telemetryMatched: (inMsg: XcmInbound, outMsg: XcmSent) => void
  telemetryTimeout: (message: XcmTimeout) => void
  telemetryHop: (message: XcmHop) => void
  telemetryBridge: (message: XcmBridge) => void
  telemetryTrapped: (inMsg: XcmInbound, outMsg: XcmSent) => void
}

export type TelemetryXCMEventEmitter = TypedEventEmitter<TelemetryEvents>
