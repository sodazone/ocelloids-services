import type { QuerySubscription, XcmNotifyMessage } from './server-types';

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