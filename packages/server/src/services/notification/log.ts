import EventEmitter from 'node:events'

import { Logger, Services } from '../../services/types.js'
import {
  Subscription,
  XcmHop,
  XcmNotificationType,
  XcmNotifyMessage,
  isXcmHop,
  isXcmReceived,
  isXcmRelayed,
  isXcmSent,
} from '../monitoring/types.js'
import { NotifierHub } from './hub.js'
import { Notifier, NotifierEmitter } from './types.js'

export class LogNotifier extends (EventEmitter as new () => NotifierEmitter) implements Notifier {
  #log: Logger

  constructor(hub: NotifierHub, { log }: Services) {
    super()

    this.#log = log

    hub.on('log', this.notify.bind(this))
  }

  notify(sub: Subscription, msg: XcmNotifyMessage) {
    if (isXcmReceived(msg)) {
      this.#log.info(
        '[%s ➜ %s] NOTIFICATION %s subscription=%s, messageHash=%s, outcome=%s (o: #%s, d: #%s)',
        msg.origin.chainId,
        msg.destination.chainId,
        msg.type,
        sub.id,
        msg.waypoint.messageHash,
        msg.waypoint.outcome,
        msg.origin.blockNumber,
        msg.destination.blockNumber
      )
    } else if (isXcmHop(msg)) {
      this.#notifyHop(sub, msg)
    } else if (isXcmRelayed(msg) && msg.type === XcmNotificationType.Relayed) {
      this.#log.info(
        '[%s ↠ %s] NOTIFICATION %s subscription=%s, messageHash=%s, block=%s',
        msg.origin.chainId,
        msg.destination.chainId,
        msg.type,
        sub.id,
        msg.waypoint.messageHash,
        msg.waypoint.blockNumber
      )
    } else if (isXcmSent(msg)) {
      this.#log.info(
        '[%s ➜] NOTIFICATION %s subscription=%s, messageHash=%s, block=%s',
        msg.origin.chainId,
        msg.type,
        sub.id,
        msg.waypoint.messageHash,
        msg.origin.blockNumber
      )
    }
  }

  #notifyHop(sub: Subscription, msg: XcmHop) {
    if (msg.direction === 'out') {
      this.#log.info(
        '[%s ↷] NOTIFICATION %s-%s subscription=%s, messageHash=%s, block=%s',
        msg.waypoint.chainId,
        msg.type,
        msg.direction,
        sub.id,
        msg.waypoint.messageHash,
        msg.waypoint.blockNumber
      )
    } else if (msg.direction === 'in') {
      this.#log.info(
        '[↷ %s] NOTIFICATION %s-%s subscription=%s, messageHash=%s, block=%s',
        msg.waypoint.chainId,
        msg.type,
        msg.direction,
        sub.id,
        msg.waypoint.messageHash,
        msg.waypoint.blockNumber
      )
    }
  }
}
