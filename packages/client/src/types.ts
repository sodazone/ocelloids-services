import {
  XcmNotifyMessage,
  XcmReceived,
  XcmRelayed,
  XcmSent
} from './lib';

/**
 * Represents a {@link Subscription} delivery channel.
 *
 * @public
 */
export type DeliveryChannel = {
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
};

/**
 * Represents a persistent subscription.
 *
 * @example
 * ```typescript
 * {
 *   id: "polkadot-transfers",
 *   origin: "0",
 *   senders: "*",
 *   destinations: [
 *     "2000",
 *     "1000"
 *   ],
 *   events: "*",
 *   channels: [
 *     {
 *       type: "webhook",
 *       url: "https://some.webhook"
 *     },
 *     {
 *       type: "websocket"
 *     }
 *   ]
 * }
 * ```
 *
 * @public
 */
export type Subscription = {
  /**
   * The subscription id.
   * Must be unique.
   */
  id: string;

  /**
   * The origin chain id.
   */
  origin: string;

  /**
   * An array of sender addresses or '*' for all.
   */
  senders?: ('*' | string[]);

  /**
   * An array of destination chain ids.
   */
  destinations: string[];

  /**
   * Indicates the persistence preference.
   */
  ephemeral?: boolean;

  /**
   * An array of delivery channels.
   */
  channels: DeliveryChannel[];

  /**
   * An optional array with the events to deliver.
   * Use '*' for all.
   * @see {@link XcmNotificationType} for supported event names.
   */
  events?: ('*' | string[]);
}

/**
 * The XCM event types.
 *
 * @public
 */
export enum XcmNotificationType {
  Sent = 'xcm.sent',
  Received = 'xcm.received',
  Relayed = 'xcm.relayed',
  Hop = 'xcm.hop'
}

/**
 * Represents an on-demand subscription.
 *
 * @public
 */
export type OnDemandSubscription = Omit<Subscription, 'id'|'channels'>;

/**
 * Guard condition for {@link Subscription}.
 *
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
 * Guard condition for {@link XcmSent}.
 *
 * @public
 */
export function isXcmSent(object: any): object is XcmSent {
  return object.type !== undefined && object.type === XcmNotificationType.Sent;
}

/**
 * Guard condition for {@link XcmReceived}.
 *
 * @public
 */
export function isXcmReceived(object: any): object is XcmReceived {
  return object.type !== undefined && object.type === XcmNotificationType.Received;
}

/**
 * Guard condition for {@link XcmRelayed}.
 *
 * @public
 */
export function isXcmRelayed(object: any): object is XcmRelayed {
  return object.type !== undefined && object.type === XcmNotificationType.Relayed;
}
