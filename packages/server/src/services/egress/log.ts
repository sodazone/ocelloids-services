import EventEmitter from 'node:events'

import { Subscription } from '@/services/subscriptions/types.js'
import { Logger, Services } from '@/services/types.js'

import { Egress } from './hub.js'
import { Message, Publisher, PublisherEmitter } from './types.js'

export class LogPublisher extends (EventEmitter as new () => PublisherEmitter) implements Publisher {
  #log: Logger

  constructor(egress: Egress, { log }: Services) {
    super()

    this.#log = log

    egress.on('log', this.publish.bind(this))
  }

  publish(_sub: Subscription, msg: Message) {
    this.#log.info(
      'MESSAGE %s agent=%s subscription=%s, payload=%j',
      msg.metadata.type,
      msg.metadata.agentId,
      msg.metadata.subscriptionId,
      msg.payload,
    )
  }
}
