import EventEmitter from 'node:events';

import { Logger, Services, TelementryNotifierEvents } from '../types.js';
import { QuerySubscription, XcmMessageNotify } from '../monitoring/types.js';
import { LogNotifier } from './log.js';
import { Notifier } from './types.js';
import { WebhookNotifier } from './webhook.js';

/**
 * Notifier hub.
 *
 * Provides resolution of the supported notifiers.
 */
export class NotifierHub extends EventEmitter implements Notifier {
  #log: Logger;
  #notifiers: {
    [property: string]: Notifier
  };

  constructor(services: Services) {
    super();

    this.#log = services.log;
    this.#notifiers = {
      log: new LogNotifier(services),
      webhook: new WebhookNotifier(services)
    };

    // delegate telemetry events
    for (const n of Object.values(this.#notifiers)) {
      for (const t of Object.values(TelementryNotifierEvents)) {
        n.on(t, (...args: any[]) => {
          this.emit(t, ...args);
        });
      }
    }
  }

  async notify(sub: QuerySubscription, msg: XcmMessageNotify) {
    try {
      await this.#notifiers[sub.notify.type].notify(sub, msg);
    } catch (error) {
      this.#log.error(error);
    }
  }
}
