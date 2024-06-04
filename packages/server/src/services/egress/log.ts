import EventEmitter from 'node:events'

import { Logger, Services } from '../../services/types.js'
import { Subscription } from '../subscriptions/types.js'
import { NotifierHub } from './hub.js'
import { Notifier, NotifierEmitter, NotifyMessage } from './types.js'

export class LogNotifier extends (EventEmitter as new () => NotifierEmitter) implements Notifier {
  #log: Logger

  constructor(hub: NotifierHub, { log }: Services) {
    super()

    this.#log = log

    hub.on('log', this.notify.bind(this))
  }

  notify(_sub: Subscription, msg: NotifyMessage) {
    this.#log.info(
      'NOTIFICATION %s agent=%s subscription=%s, payload=%j',
      msg.metadata.type,
      msg.metadata.agentId,
      msg.metadata.subscriptionId,
      msg.payload
    )
  }
}
