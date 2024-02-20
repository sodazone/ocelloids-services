import {
  XcmNotifyMessage,
  XcmReceived,
  XcmSent
} from './lib';

/**
 * @public
 */
export type Subscription = {
  id: string;
  origin: string;
  senders?: ('*' | string[]);
  destinations: string[];
  ephemeral?: boolean;
  channels: ({
    type: 'webhook';
    url: string;
    contentType?: string;
    events?: ('*' | string[]);
    template?: string;
    bearer?: string;
    limit?: number;
  } | {
    type: 'log';
  } | {
    type: 'websocket';
  })[];
  events?: ('*' | string[]);
}

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
export type OnDemandSubscription = Omit<Subscription, 'id'|'channels'>;

/**
 * @public
 */
export function isSubscription(
  obj: Subscription | XcmNotifyMessage
): obj is Subscription {
  const maybeSub = (obj as Subscription);
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