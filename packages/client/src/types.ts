import {
  QuerySubscription,
  XcmNotifyMessage
} from 'xcmon-server';

export type {
  QuerySubscription,
  XcmNotifyMessage,
  XcmNotificationType,
  XcmSent,
  XcmReceived,
  XcmRelayed,
  isXcmSent,
  isXcmReceived,
  isXcmRelayed
} from 'xcmon-server';

export type OnDemandQuerySubscription = Omit<QuerySubscription, 'id'|'channels'>;

export function isQuerySubscription(
  obj: QuerySubscription | XcmNotifyMessage
): obj is QuerySubscription {
  const maybeSub = (obj as QuerySubscription);
  return maybeSub.origin !== undefined
  && maybeSub.destinations !== undefined
  && maybeSub.id !== undefined
  && maybeSub.channels !== undefined;
}