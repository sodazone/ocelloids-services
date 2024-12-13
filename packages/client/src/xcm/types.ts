import { sourceXcm } from '../server-types'

/**
 * The XCM event types.
 *
 * @public
 */
export type XcmNotificationType = sourceXcm.XcmNotificationType

/**
 * XCM sent event.
 *
 * @public
 */
export type XcmSent = sourceXcm.XcmSent

/**
 * XCM received event.
 *
 * @public
 */
export type XcmReceived = sourceXcm.XcmReceived

/**
 * XCM relayed event.
 *
 * @public
 */
export type XcmRelayed = sourceXcm.XcmRelayed

/**
 * XCM hop event.
 *
 * @public
 */
export type XcmHop = sourceXcm.XcmHop

/**
 * XCM bridge event.
 *
 * @public
 */
export type XcmBridge = sourceXcm.XcmBridge

/**
 * XCM timeout event.
 *
 * @public
 */
export type XcmTimeout = sourceXcm.XcmTimeout

/**
 * The XCM notification payload.
 *
 * @public
 */
export type XcmMessagePayload = sourceXcm.XcmMessagePayload

/**
 * XCM assets trapped event.
 *
 * @public
 */
export type XcmAssetsTrapped = sourceXcm.AssetsTrapped

/**
 * XCM trapped asset data.
 *
 * @public
 */
export type XcmTrappedAsset = sourceXcm.TrappedAsset

/**
 * The leg of an XCM journey.
 *
 * @public
 */
export type XcmLeg = sourceXcm.Leg

/**
 * The XcmTerminus contextual information.
 *
 * @public
 */
export type XcmTerminusContext = sourceXcm.XcmTerminusContext

/**
 * Terminal point of an XCM journey.
 *
 * @public
 */
export type XcmTerminus = sourceXcm.XcmTerminus

/**
 * The XCM waypoint contextual information.
 *
 * @public
 */
export type XcmWaypointContext = sourceXcm.XcmWaypointContext

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
  return object.type !== undefined && object.type === 'xcm.sent'
}

/**
 * Guard condition for XcmReceived.
 *
 * @public
 */
export function isXcmReceived(object: any): object is XcmReceived {
  return object.type !== undefined && object.type === 'xcm.received'
}

/**
 * Guard condition for XcmRelayed.
 *
 * @public
 */
export function isXcmRelayed(object: any): object is XcmRelayed {
  return object.type !== undefined && object.type === 'xcm.relayed'
}
