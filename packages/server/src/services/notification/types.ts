import { TypedEventEmitter } from '../index.js'
import { AnyJson, Subscription } from '../monitoring/types.js'
import { TelemetryNotifierEvents } from '../telemetry/types.js'

export type NotifyMessage = {
  metadata: {
    type: string
    agentId: string
    subscriptionId: string
  }
  payload: AnyJson
}

export type NotifierEvents = {
  log: (sub: Subscription, msg: NotifyMessage) => void
  webhook: (sub: Subscription, msg: NotifyMessage) => void
  websocket: (sub: Subscription, msg: NotifyMessage) => void
}

export type NotifierEmitter = TypedEventEmitter<NotifierEvents & TelemetryNotifierEvents>

export interface Notifier extends NotifierEmitter {
  notify(sub: Subscription, msg: NotifyMessage): void | Promise<void>
}
