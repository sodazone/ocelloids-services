import EventEmitter from 'node:events'

import { Subscription } from '../subscriptions/types.js'
import { TelemetryNotifierEventKeys } from '../telemetry/types.js'
import { Logger, Services } from '../types.js'
import { LogPublisher } from './log.js'
import { TelegramPublisher } from './messaging/telegram.js'
import { Message, Publisher, PublisherEmitter } from './types.js'
import { WebhookPublisher } from './webhook.js'

type Publishers = {
  [property: string]: Publisher
}

async function executeAll(publishers: Publishers, key: 'start' | 'stop') {
  return await Promise.all(Object.values(publishers).flatMap((p) => (p[key] ? [p[key]!()] : [])))
}

/**
 * Provides resolution of the supported publishers.
 */
export class Egress extends (EventEmitter as new () => PublisherEmitter) implements Publisher {
  #log: Logger
  #publishers: Publishers

  constructor(services: Services) {
    super()

    this.#log = services.log

    this.#publishers = {
      log: new LogPublisher(this, services),
      webhook: new WebhookPublisher(this, services),
      telegram: new TelegramPublisher(this, services),
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

  /**
   * Terminates a subscription.
   *
   * @param sub - The subscription.
   */
  terminate(sub: Subscription) {
    this.emit('terminate', sub)
  }

  /**
   * Stops publishers.
   */
  async stop() {
    this.#log.info('[egress] stop')
    await executeAll(this.#publishers, 'stop')
  }

  /**
   * Starts publishers.
   */
  async start() {
    this.#log.info('[egress] start')
    await executeAll(this.#publishers, 'start')
  }
}
