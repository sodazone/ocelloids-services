import { Logger } from '../../../services/types.js';
import { QuerySubscription, XcmMessageNotify } from '../types.js';
import { NotifyHandler } from './notifier.js';

export function logNotifyHandler(
  log: Logger
) : NotifyHandler {
  return (
    sub: QuerySubscription,
    msg: XcmMessageNotify
  ) => {
    log.info(
      '[%s ➜ %s] NOTIFICATION subscription=%s, messageHash=%s, outcome=%s (o: #%s, d: #%s)',
      msg.origin.chainId,
      msg.destination.chainId,
      sub.id,
      msg.messageHash,
      msg.outcome,
      msg.origin.blockNumber,
      msg.destination.blockNumber
    );
  };
}