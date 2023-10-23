import got from 'got';

import { QuerySubscription, XcmMessageNotify } from '../types.js';
import { NotifyHandler } from './notifier.js';

export function webhookNotifyHandler() : NotifyHandler {
  return async (sub: QuerySubscription, msg: XcmMessageNotify) => {
    const { notify } = sub;
    // TODO handle cancellable...
    try {
      if (notify.type === 'webhook') {
        const res = await got.post<XcmMessageNotify>(notify.url, {
          json: msg,
          retry: {
            limit: undefined,
            backoffLimit: 900000
          }
        });

        if (res.statusCode >= 200 && res.statusCode < 300) {
        // notified
        } else {
        // Keep notifiying
        // setTimeOut...
        }
      }
    } catch (error) {
      // retry limit reached?
      console.log(error);
    }
  };
}