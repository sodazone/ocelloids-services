import { TypedEventEmitter } from '../../../types.js'
import { XcmBridge, XcmHop, XcmInbound, XcmRelayed, XcmSent, XcmTimeout } from '../types.js'

export type TelemetryEvents = {
  telemetryXcmInbound: (message: XcmInbound) => void
  telemetryXcmOutbound: (message: XcmSent) => void
  telemetryXcmRelayed: (relayMsg: XcmRelayed) => void
  telemetryXcmMatched: (inMsg: XcmInbound, outMsg: XcmSent) => void
  telemetryXcmTimeout: (message: XcmTimeout) => void
  telemetryXcmHop: (message: XcmHop) => void
  telemetryXcmBridge: (message: XcmBridge) => void
  telemetryXcmTrapped: (inMsg: XcmInbound, outMsg: XcmSent) => void
  telemetryXcmSubscriptionError: (msg: {
    subscriptionId: string
    chainId: string
    direction: 'in' | 'out' | 'relay' | 'bridge'
  }) => void
}

export type TelemetryXCMEventEmitter = TypedEventEmitter<TelemetryEvents>
