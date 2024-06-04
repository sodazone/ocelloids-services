import EventEmitter from 'node:events'

import { Subscription } from '../subscriptions/types.js'
import { TelemetryNotifierEventKeys } from '../telemetry/types.js'
import { Services } from '../types.js'
import { LogPublisher } from './log.js'
import { Message, Publisher, PublisherEmitter } from './types.js'
import { WebhookPublisher } from './webhook.js'

/**
 * Provides resolution of the supported publishers.
 */
export class PublisherHub extends (EventEmitter as new () => PublisherEmitter) implements Publisher {
  // #log: Logger;
  #publishers: {
    [property: string]: Publisher
  }

  constructor(services: Services) {
    super()

    // this.#log = services.log;
    this.#publishers = {
      log: new LogPublisher(this, services),
      webhook: new WebhookPublisher(this, services),
    }

    // delegate telemetry events
    for (const n of Object.values(this.#publishers)) {
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
  publish(sub: Subscription, msg: Message) {
    const types: any[] = []
    for (const { type } of sub.channels) {
      if (types.indexOf(type) === -1) {
        types.push(type)
        this.emit(type, sub, msg)
      }
    }
  }
}
