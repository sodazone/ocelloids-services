import { EventEmitter } from 'node:events';

import got from 'got';
import { ulid } from 'ulidx';

import version from '../../version.js';
import { QuerySubscription, WebhookNotification, XcmMatched } from '../monitoring/types.js';
import { Logger, Services, TelementryNotifierEvents as telemetry } from '../types.js';

import { Notifier } from './types.js';
import { TemplateRenderer } from './template.js';
import { Scheduled, Scheduler, SubsStore } from '../persistence/index.js';

const DEFAULT_DELAY = 300000; // 5 minutes

type WebhookTask = {
  id: string
  subId: string
  msg: XcmMatched
}
const WebhookTaskType = 'task:webhook';

export const Delivered = Symbol('delivered');

function buildPostUrl(url: string, id: string) {
  return [url, id]
    .join('/')
    .replace(/([^:]\/)\/+/g, '$1');
}

/**
 * WebhookNotifier ensures reliable delivery of webhook notifications.
 *
 * Features:
 * - Immediate and scheduled retry logic.
 * - Text templates for the body payload.
 */
export class WebhookNotifier extends EventEmitter implements Notifier {
  #log: Logger;
  #scheduler: Scheduler;
  #subs: SubsStore;
  #renderer: TemplateRenderer;

  constructor({ log, scheduler, storage: { subs } }: Services) {
    super();

    this.#log = log;
    this.#scheduler = scheduler;
    this.#subs = subs;
    this.#renderer = new TemplateRenderer();

    this.#scheduler.on(WebhookTaskType, this.#dispatch.bind(this));
  }

  async notify(
    sub: QuerySubscription,
    msg: XcmMatched
  ) {
    const { id, notify } = sub;

    if (notify.type === 'webhook') {
      const taskId = ulid();
      const scheduled : Scheduled<WebhookTask> = {
        type: WebhookTaskType,
        task: {
          id: taskId,
          subId: id,
          msg
        }
      };
      await this.#dispatch(scheduled);
    }
  }

  async #dispatch(scheduled: Scheduled<WebhookTask>) {
    const { task: { subId } } = scheduled;

    try {
      const sub = await this.#subs.getById(subId);
      const config = sub.notify as WebhookNotification;
      await this.#post(scheduled, config);
    } catch (error) {
      // do not re-schedule
      this.#log.error(error, 'Webhook dispatch error');
    }
  }

  async #post(
    scheduled: Scheduled<WebhookTask>,
    config: WebhookNotification
  ) {
    const { task: { id, msg } } = scheduled;
    const { contentType, url, limit, template } = config;
    const postUrl = buildPostUrl(url, id);

    try {
      const res = await got.post<XcmMatched>(postUrl, {
        body: template === undefined
          ? JSON.stringify(msg)
          : this.#renderer.render({ template, data: msg }),
        headers: {
          'user-agent': 'xcmon/' + version,
          'content-type': contentType ?? 'application/json'
        },
        retry: {
          limit: limit ?? 5,
          methods: ['POST']
        },
        context: {
          bearer: config.bearer
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
          postUrl,
          msg.messageHash,
          msg.outcome,
          msg.origin.blockNumber,
          msg.destination.blockNumber
        );

        this.emit(Delivered, {
          id,
          msg
        });

        this.emit(telemetry.Notify, {
          type: config.type,
          subscription: msg.subscriptionId,
          origin: msg.origin.chainId,
          destination: msg.destination.chainId,
          outcome: msg.outcome,
          sink: config.url
        });
      } else {
        // Should not enter here, since the non success status codes
        // are retryable and will throw an exception when the limit
        // of retries is reached.
        this.#log.error(
          'Not deliverable webhook %s %s',
          postUrl,
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

      this.emit(telemetry.NotifyError, {
        type: config.type,
        subscription: msg.subscriptionId,
        origin: msg.origin.chainId,
        destination: msg.destination.chainId,
        outcome: msg.outcome,
        sink: config.url,
        error: 'max_retries'
      });
    }
  }
}