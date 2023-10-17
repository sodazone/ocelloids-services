import { Logger } from 'services/types.js';
import { QuerySubscription, XcmMessageNotify } from './types.js';

export class Notifier {
  #log: Logger;

  constructor(log: Logger) {
    this.#log = log;
  }

  notify(sub: QuerySubscription, msg: XcmMessageNotify) {
    try {
      if (sub.notify.type === 'log') {
        this.#log.info(
          '[%s => %s] NOTIFICATION subscription=%s, messageHash=%s, outcome=%s (o: #%s, d: #%s)',
          msg.origin.chainId,
          msg.destination.chainId,
          sub.id,
          msg.messageHash,
          msg.outcome,
          msg.origin.blockNumber,
          msg.destination.blockNumber
        );
      } else if (sub.notify.type === 'webhook') {
        // TODO impl
      }
    } catch (error) {
      this.#log.error(error);
    }
  }
}
