import type { xcm } from '@sodazone/ocelloids-service-node'

/**
 * The XCM event types.
 *
 * @public
 */
export enum XcmNotificationType {
  Sent = 'xcm.sent',
  Received = 'xcm.received',
  Relayed = 'xcm.relayed',
  Timeout = 'xcm.timeout',
  Hop = 'xcm.hop',
}

/**
 * XCM Agent subscription inputs.
 *
 * @public
 */
export type XcmSubscriptionInputs = {
  /**
   * The origin chain id.
   */
  origin: string

  /**
   * An array of sender addresses or '*' for all.
   */
  senders?: '*' | string[]

  /**
   * An array of destination chain ids.
   */
  destinations: string[]

  /**
   * An optional array with the events to deliver.
   * Use '*' for all.
   * @see {@link XcmNotificationType} for supported event names.
   */
  events?: '*' | XcmNotificationType[]
}

/**
 * Guard condition for {@link xcm.XcmSent}.
 *
 * @public
 */
export function isXcmSent(object: any): object is xcm.XcmSent {
  return object.type !== undefined && object.type === XcmNotificationType.Sent
}

/**
 * Guard condition for {@link xcm.XcmReceived}.
 *
 * @public
 */
export function isXcmReceived(object: any): object is xcm.XcmReceived {
  return object.type !== undefined && object.type === XcmNotificationType.Received
}

/**
 * Guard condition for {@link xcm.XcmRelayed}.
 *
 * @public
 */
export function isXcmRelayed(object: any): object is xcm.XcmRelayed {
  return object.type !== undefined && object.type === XcmNotificationType.Relayed
}
