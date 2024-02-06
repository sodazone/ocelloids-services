import EventEmitter from 'node:events';

import { Logger, Services } from '../types.js';
import { QuerySubscription, XcmMatched } from '../monitoring/types.js';
import { Notifier, NotifierEmitter } from './types.js';
import { LogNotifier } from './log.js';
import { WebhookNotifier } from './webhook.js';
import { TelemetryNotifierEventKeys } from '../telemetry/types.js';

/**
 * Notifier hub.
 *
 * Provides resolution of the supported notifiers.
 */
export class NotifierHub extends (EventEmitter as new () => NotifierEmitter) implements Notifier {
  #log: Logger;
  #notifiers: {
    [property: string]: Notifier
  };

  constructor(services: Services) {
    super();

    this.#log = services.log;
    this.#notifiers = {
      log: new LogNotifier(this, services),
      webhook: new WebhookNotifier(this, services),
    };

    // delegate telemetry events
    for (const n of Object.values(this.#notifiers)) {
      for (const t of TelemetryNotifierEventKeys) {
        n.on(t, msg => {
          this.emit(t, msg);
        });
      }
    }
  }

  /**
   * Notifies an XCM match in the context of a subscription.
   *
   * @param sub The subscription.
   * @param msg The message.
   */
  notify(sub: QuerySubscription, msg: XcmMatched) {
    this.emit(sub.notify.type, sub, msg);
  }
}
