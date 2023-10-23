import got from 'got';

import { QuerySubscription, XcmMessageNotify } from '../types.js';
import { DB, Logger, Services } from 'services/types.js';
import { Notifier } from './types.js';

export class WebhookNotifier implements Notifier {
  #log: Logger;
  #db: DB;

  constructor({ log, storage: { db } }: Services) {
    this.#log = log;
    this.#db = db;
  }

  stop(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async notify(
    sub: QuerySubscription,
    msg: XcmMessageNotify
  ) {
    const { notify } = sub;
    // TODO handle cancellable?
    if (notify.type === 'webhook') {
      try {
        const res = await got.post<XcmMessageNotify>(notify.url, {
          json: msg,
          retry: {
            limit: undefined,
            backoffLimit: 900000
          }
        });

        return res.statusCode >= 200 && res.statusCode < 300;
      } catch (error) {
        this.#log.warn(
          error,
          'Error while posting to webhook %s',
          notify.url
        );
      }
    }
    return false;
  }
}