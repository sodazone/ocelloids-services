import EventEmitter from 'node:events'

import { Subscription } from '../subscriptions/types.js'
import { TelemetryNotifierEventKeys } from '../telemetry/types.js'
import { Services } from '../types.js'
import { LogNotifier } from './log.js'
import { Notifier, NotifierEmitter, NotifyMessage } from './types.js'
import { WebhookNotifier } from './webhook.js'

/**
 * Notifier hub.
 *
 * Provides resolution of the supported notifiers.
 */
export class NotifierHub extends (EventEmitter as new () => NotifierEmitter) implements Notifier {
  // #log: Logger;
  #notifiers: {
    [property: string]: Notifier
  }

  constructor(services: Services) {
    super()

    // this.#log = services.log;
    this.#notifiers = {
      log: new LogNotifier(this, services),
      webhook: new WebhookNotifier(this, services),
    }

    // delegate telemetry events
    for (const n of Object.values(this.#notifiers)) {
      for (const t of TelemetryNotifierEventKeys) {
        n.on(t, (msg) => {
          this.emit(t, msg)
        })
      }
    }
  }

  /**
   * Notifies a message in the context of a subscription.
   *
   * @param sub - The subscription.
   * @param msg - The message.
   */
  notify(sub: Subscription, msg: NotifyMessage) {
    const types: any[] = []
    for (const { type } of sub.channels) {
      if (types.indexOf(type) === -1) {
        types.push(type)
        this.emit(type, sub, msg)
      }
    }
  }
}
