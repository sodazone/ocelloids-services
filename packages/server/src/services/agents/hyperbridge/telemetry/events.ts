import { TypedEventEmitter } from '@/services/types.js'

import {
  HyperbridgeDispatched,
  HyperbridgeReceived,
  HyperbridgeRelayed,
  HyperbridgeTimeout,
  HyperbridgeUnmatched,
} from '../types.js'
import { JanitorTask } from '@/services/scheduling/janitor.js'

export type TelemetryEvents = {
  telemetryIsmpOutbound: (message: HyperbridgeDispatched) => void
  telemetryIsmpRelayed: (message: HyperbridgeRelayed) => void
  telemetryIsmpReceived: (message: HyperbridgeReceived) => void
  telemetryIsmpTimeout: (message: HyperbridgeTimeout) => void
  telemetryHyperbridgeUnmatched: (message: HyperbridgeUnmatched) => void
  telemetryHyperbridgeError: (error: { code: string; id: string }) => void
  telemetryHyperbridgeJanitorScheduled: (task: JanitorTask) => void
  telemetryHyperbridgeJanitorSwept: (task: JanitorTask) => void
}

export type TelemetryHyperbridgeEventEmitter = TypedEventEmitter<TelemetryEvents>
