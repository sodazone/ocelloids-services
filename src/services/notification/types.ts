import EventEmitter from 'node:events';

import { QuerySubscription, XcmMessageNotify } from '../monitoring/types.js';

export interface Notifier extends EventEmitter {
  notify(sub: QuerySubscription, msg: XcmMessageNotify) : Promise<void>
}