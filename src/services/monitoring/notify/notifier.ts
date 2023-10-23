import { Logger, Services } from '../../types.js';
import { QuerySubscription, XcmMessageNotify } from '../types.js';
import { logNotifyHandler } from './log.js';
import { webhookNotifyHandler } from './webhook.js';

export type NotifyHandler = (sub: QuerySubscription, msg: XcmMessageNotify) => void;

export class Notifier {
  #log: Logger;
  #handlers: {
    [property: string]: NotifyHandler
  };

  constructor({ log }: Services) {
    this.#log = log;
    this.#handlers = {
      log: logNotifyHandler(log),
      webhook: webhookNotifyHandler()
    };
  }

  notify(sub: QuerySubscription, msg: XcmMessageNotify) {
    try {
      this.#handlers[sub.notify.type](sub, msg);
    } catch (error) {
      this.#log.error(error);
    }
  }
}
