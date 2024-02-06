import EventEmitter from 'node:events';

import { Logger, Services } from '../../services/types.js';
import { QuerySubscription, XcmMatched } from '../monitoring/types.js';
import { Notifier, NotifierEmitter } from './types.js';
import { NotifierHub } from './hub.js';

export class LogNotifier extends (EventEmitter as new () => NotifierEmitter) implements Notifier {
  #log: Logger;

  constructor(hub: NotifierHub, { log }: Services) {
    super();

    this.#log = log;

    hub.on('log', this.notify.bind(this));
  }

  notify(
    sub: QuerySubscription,
    msg: XcmMatched
  ) {
    this.#log.info(
      '[%s ➜ %s] NOTIFICATION subscription=%s, messageHash=%s, outcome=%s (o: #%s, d: #%s)',
      msg.origin.chainId,
      msg.destination.chainId,
      sub.id,
      msg.messageHash,
      msg.outcome,
      msg.origin.blockNumber,
      msg.destination.blockNumber
    );
  }
}
