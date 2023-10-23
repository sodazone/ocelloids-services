import { Logger, Services } from '../../services/types.js';
import { QuerySubscription, XcmMessageNotify } from '../monitoring/types.js';
import { Notifier } from './types.js';

export class LogNotifier implements Notifier {
  #log: Logger;

  constructor({ log }: Services) {
    this.#log = log;
  }

  notify(
    sub: QuerySubscription,
    msg: XcmMessageNotify
  ) : Promise<boolean> {
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
    return Promise.resolve(true);
  }
}
