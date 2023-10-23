import { QuerySubscription, XcmMessageNotify } from '../types.js';

export interface Notifier {
  notify(sub: QuerySubscription, msg: XcmMessageNotify) : Promise<boolean>
  stop() : Promise<void>
}