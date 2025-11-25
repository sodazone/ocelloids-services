import { TypedEventEmitter } from '@/services/types.js'

import {
  HyperbridgeDispatched,
  HyperbridgeReceived,
  HyperbridgeRelayed,
  HyperbridgeTimeout,
  HyperbridgeUnmatched,
} from '../types.js'

export type TelemetryEvents = {
  telemetryIsmpOutbound: (message: HyperbridgeDispatched) => void
  telemetryIsmpRelayed: (message: HyperbridgeRelayed) => void
  telemetryIsmpReceived: (message: HyperbridgeReceived) => void
  telemetryIsmpTimeout: (message: HyperbridgeTimeout) => void
  telemetryHyperbridgeUnmatched: (message: HyperbridgeUnmatched) => void
  telemetryHyperbridgeError: (error: { code: string; id: string }) => void
}

export type TelemetryHyperbridgeEventEmitter = TypedEventEmitter<TelemetryEvents>
