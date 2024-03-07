import EventEmitter from 'node:events';

import { Logger, Services } from '../../services/types.js';
import { Subscription, XcmNotifyMessage, isXcmReceived, isXcmSent } from '../monitoring/types.js';
import { Notifier, NotifierEmitter } from './types.js';
import { NotifierHub } from './hub.js';

export class LogNotifier extends (EventEmitter as new () => NotifierEmitter) implements Notifier {
  #log: Logger;

  constructor(hub: NotifierHub, { log }: Services) {
    super();

    this.#log = log;

    hub.on('log', this.notify.bind(this));
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
      );
    } else if (isXcmSent(msg)) {
      this.#log.info(
        '[%s ➜] NOTIFICATION %s subscription=%s, messageHash=%s, block=%s',
        msg.origin.chainId,
        msg.type,
        sub.id,
        msg.waypoint.messageHash,
        msg.origin.blockNumber
      );
    }
  }
}
