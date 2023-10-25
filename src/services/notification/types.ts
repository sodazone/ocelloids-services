import { QuerySubscription, XcmMessageNotify } from '../monitoring/types.js';

export interface Notifier {
  notify(sub: QuerySubscription, msg: XcmMessageNotify) : Promise<void>
}