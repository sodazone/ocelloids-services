import { QuerySubscription, XcmNotifyMessage } from '../monitoring/types.js';
import { TelemetryNotifierEvents } from '../telemetry/types.js';
import { TypedEventEmitter } from '../index.js';

export type NotifierEvents = {
  log: (sub: QuerySubscription, msg: XcmNotifyMessage) => void,
  webhook: (sub: QuerySubscription,  msg: XcmNotifyMessage) => void,
  websocket: (sub: QuerySubscription, msg: XcmNotifyMessage) => void
}

export type NotifierEmitter = TypedEventEmitter<NotifierEvents & TelemetryNotifierEvents>;

export interface Notifier extends NotifierEmitter {
  notify(sub: QuerySubscription, msg: XcmNotifyMessage) : void | Promise<void>
}
