import { QuerySubscription, XcmMatched } from '../monitoring/types.js';
import { TelemetryNotifierEvents } from '../telemetry/types.js';
import { TypedEventEmitter } from '../index.js';

export type NotifierEvents = {
  log: (sub: QuerySubscription, msg: XcmMatched) => void,
  webhook: (sub: QuerySubscription,  msg: XcmMatched) => void,
  websocket: (sub: QuerySubscription, msg: XcmMatched) => void
}

export type NotifierEmitter = TypedEventEmitter<NotifierEvents & TelemetryNotifierEvents>;

export interface Notifier extends NotifierEmitter {
  notify(sub: QuerySubscription, msg: XcmMatched) : void | Promise<void>
}
