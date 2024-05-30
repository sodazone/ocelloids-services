import { TypedEventEmitter } from '../index.js'
import { AnyJson, Subscription } from '../subscriptions/types.js'
import { TelemetryNotifierEvents } from '../telemetry/types.js'

/**
 * The generic message.
 *
 * @public
 */
export type NotifyMessage<T = AnyJson> = {
  metadata: {
    type: string
    agentId: string
    subscriptionId: string
  }
  payload: T
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
