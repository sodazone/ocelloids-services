import EventEmitter from 'node:events';

import { QuerySubscription, XcmMatched } from '../monitoring/types.js';

export interface Notifier extends EventEmitter {
  notify(sub: QuerySubscription, msg: XcmMatched) : Promise<void>
}