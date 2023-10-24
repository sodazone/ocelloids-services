import Stream from 'node:stream';

import got from 'got';
import { ulid } from 'ulidx';

import version from '../../version.js';
import { QuerySubscription, XcmMessageNotify } from '../monitoring/types.js';
import { Logger, Services } from 'services/types.js';

import { Notifier } from './types.js';
import { Scheduler } from 'services/persistence/scheduler.js';

export const Delivered = Symbol('delivered');

export class WebhookNotifier
  extends Stream.EventEmitter
  implements Notifier {
  #log: Logger;
  #scheduler: Scheduler;

  constructor({ log, scheduler }: Services) {
    super();

    this.#log = log;
    this.#scheduler = scheduler;
  }

  async notify(
    sub: QuerySubscription,
    msg: XcmMessageNotify
  ) {
    const { notify } = sub;
    // TODO handle cancellable?
    if (notify.type === 'webhook') {
      const id = ulid();
      try {
        await this.#notis.put(id, msg);
        const url = [notify.url, id]
          .join('/')
          .replace(/([^:]\/)\/+/g, '$1');
        const res = await got.post<XcmMessageNotify>(url, {
          json: msg,
          headers: {
            accept: 'application/vnd.github.v3+json',
            'user-agent': 'xcmon/' + version
          },
          retry: {
            limit: undefined,
            backoffLimit: 900000,
            methods: ['POST']
          },
          context: {
            bearer: notify.bearer,
          },
          hooks: {
            init: [
              (raw, options) => {
                if ('bearer' in raw) {
                  options.context.bearer = raw.bearer;
                  delete raw.bearer;
                }
              }
            ],
            beforeRequest: [
              options => {
                const { bearer } = options.context;
                if (bearer && !options.headers.authorization) {
                  options.headers.authorization = `Bearer ${bearer}`;
                }
              }
            ]
          },
        });

        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.#log.info('DELIVERED');
          this.emit(Delivered, {
            id,
            msg
          });
          await this.#notis.del(id);
        } else {
          // TODO store in not deliverable reason
        }
      } catch (error) {
        this.#log.warn(
          error,
          'Error while posting to webhook %s',
          notify.url
        );
      }
    }
  }
}