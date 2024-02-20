import { Subscription, XcmNotifyMessage } from '../monitoring/types.js';
import { TelemetryNotifierEvents } from '../telemetry/types.js';
import { TypedEventEmitter } from '../index.js';

export type NotifierEvents = {
  log: (sub: Subscription, msg: XcmNotifyMessage) => void,
  webhook: (sub: Subscription,  msg: XcmNotifyMessage) => void,
  websocket: (sub: Subscription, msg: XcmNotifyMessage) => void
}

export type NotifierEmitter = TypedEventEmitter<NotifierEvents & TelemetryNotifierEvents>;

export interface Notifier extends NotifierEmitter {
  notify(sub: Subscription, msg: XcmNotifyMessage) : void | Promise<void>
}
