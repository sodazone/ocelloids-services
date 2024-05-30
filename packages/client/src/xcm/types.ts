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
 * XCM sent event.
 *
 * @public
 */
export type XcmSent = xcm.XcmSent
/**
 * XCM received event.
 *
 * @public
 */
export type XcmReceived = xcm.XcmReceived
/**
 * XCM relayed event.
 *
 * @public
 */
export type XcmRelayed = xcm.XcmRelayed
/**
 * XCM hop event.
 *
 * @public
 */
export type XcmHop = xcm.XcmHop
/**
 * XCM bridge event.
 *
 * @public
 */
export type XcmBridge = xcm.XcmBridge
/**
 * XCM timeout event.
 *
 * @public
 */
export type XcmTimeout = xcm.XcmTimeout
/**
 * The XCM notification payload.
 *
 * @public
 */
export type XcmNotifyMessage = xcm.XcmNotifyMessage
/**
 * XCM assets trapped event.
 *
 * @public
 */
export type XcmAssetsTrapped = xcm.AssetsTrapped
/**
 * XCM trapped asset data.
 *
 * @public
 */
export type XcmTrappedAsset = xcm.TrappedAsset
/**
 * The leg of an XCM journey.
 *
 * @public
 */
export type XcmLeg = xcm.Leg
/**
 * The XcmTerminus contextual information.
 *
 * @public
 */
export type XcmTerminusContext = xcm.XcmTerminusContext
/**
 * Terminal point of an XCM journey.
 *
 * @public
 */
export type XcmTerminus = xcm.XcmTerminus
/**
 * The XCM waypoint contextual information.
 *
 * @public
 */
export type XcmWaypointContext = xcm.XcmWaypointContext

/**
 * XCM Agent subscription inputs.
 *
 * @public
 */
export type XcmInputs = {
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
   */
  events?: '*' | XcmNotificationType[]
}

/**
 * Guard condition for XcmSent.
 *
 * @public
 */
export function isXcmSent(object: any): object is XcmSent {
  return object.type !== undefined && object.type === XcmNotificationType.Sent
}

/**
 * Guard condition for XcmReceived.
 *
 * @public
 */
export function isXcmReceived(object: any): object is XcmReceived {
  return object.type !== undefined && object.type === XcmNotificationType.Received
}

/**
 * Guard condition for XcmRelayed.
 *
 * @public
 */
export function isXcmRelayed(object: any): object is XcmRelayed {
  return object.type !== undefined && object.type === XcmNotificationType.Relayed
}
