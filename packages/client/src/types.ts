import {
  QuerySubscription,
  XcmNotifyMessage,
  XcmReceived,
  XcmSent
} from './lib';

/**
 * @public
 */
export enum XcmNotificationType {
  Sent = 'xcm.sent',
  Received = 'xcm.received',
  Relayed = 'xcm.relayed',
  Hop = 'xcm.hop'
}

/**
 * @public
 */
export type OnDemandQuerySubscription = Omit<QuerySubscription, 'id'|'channels'>;

/**
 * @public
 */
export function isQuerySubscription(
  obj: QuerySubscription | XcmNotifyMessage
): obj is QuerySubscription {
  const maybeSub = (obj as QuerySubscription);
  return maybeSub.origin !== undefined
  && maybeSub.destinations !== undefined
  && maybeSub.id !== undefined
  && maybeSub.channels !== undefined;
}

/**
 * @public
 */
export function isXcmSent(object: any): object is XcmSent {
  return object.type !== undefined && object.type === XcmNotificationType.Sent;
}

/**
 * @public
 */
export function isXcmReceived(object: any): object is XcmReceived {
  return object.type !== undefined && object.type === XcmNotificationType.Received;
}