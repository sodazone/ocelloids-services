import Stream from 'node:stream';

import got from 'got';
import { ulid } from 'ulidx';

import version from '../../version.js';
import { QuerySubscription, WebhookNotification, XcmMessageNotify } from '../monitoring/types.js';
import { Logger, Services } from 'services/types.js';

import { Notifier } from './types.js';
import { Scheduled, Scheduler } from 'services/persistence/scheduler.js';

const DEFAULT_DELAY = 300000; // 5 minutes

type WebhookTask = {
  id: string
  url: string
  msg: XcmMessageNotify
  config: WebhookNotification
}
const WebhookTaskType = 'task:webhook';

export const Delivered = Symbol('delivered');

export class WebhookNotifier extends Stream.EventEmitter implements Notifier {
  #log: Logger;
  #scheduler: Scheduler;

  constructor({ log, scheduler }: Services) {
    super();

    this.#log = log;
    this.#scheduler = scheduler;

    this.#scheduler.on(WebhookTaskType, this.#post.bind(this));
  }

  async notify(
    sub: QuerySubscription,
    msg: XcmMessageNotify
  ) {
    const { notify } = sub;
    if (notify.type === 'webhook') {
      const id = ulid();
      const url = [notify.url, id]
        .join('/')
        .replace(/([^:]\/)\/+/g, '$1');
      const scheduled : Scheduled<WebhookTask> = {
        type: WebhookTaskType,
        task: {
          id,
          url,
          msg,
          config: notify
        }
      };
      await this.#post(scheduled);
    }
  }

  async #post(scheduled: Scheduled<WebhookTask>) {
    const { task: { id, url , msg, config } } = scheduled;

    try {
      const res = await got.post<XcmMessageNotify>(url, {
        json: msg,
        headers: {
          accept: 'application/vnd.github.v3+json',
          'user-agent': 'xcmon/' + version
        },
        retry: {
          limit: 5,
          methods: ['POST']
        },
        context: {
          bearer: config.bearer,
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
        this.#log.info(
          '[%s ➜ %s] NOTIFICATION subscription=%s, endpoint=%s, messageHash=%s, outcome=%s (o: #%s, d: #%s)',
          msg.origin.chainId,
          msg.destination.chainId,
          msg.subscriptionId,
          url,
          msg.messageHash,
          msg.outcome,
          msg.origin.blockNumber,
          msg.destination.blockNumber
        );
        this.emit(Delivered, {
          id,
          msg
        });
      } else {
        // TODO not deliverable reason or retry?
        this.#log.error(
          'Not deliverable webhook %s %s',
          config.url,
          id
        );
      }
    } catch (error) {
      this.#log.warn(
        error,
        'Error while posting to webhook %s',
        config.url
      );
      // Re-schedule in 5 minutes
      const time = new Date(Date.now() + DEFAULT_DELAY);
      const key = time.toISOString() + id;
      await this.#scheduler.schedule({
        ...scheduled,
        key
      });
      this.#log.info(
        'Scheduled webhook delivery %s',
        key
      );
    }
  }
}