import { Message } from '../lib'
import { sourceXcm } from '../server-types'

/**
 * A generic XCM journey.
 *
 * @public
 */
export type XcmJourney = sourceXcm.XcmJourney

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
   * An array of origin chain ids or '*' for all.
   */
  origins: '*' | string[]

  /**
   * An array of destination chain ids or '*' for all.
   */
  destinations: '*' | string[]

  /**
   * An array of sender addresses or '*' for all.
   */
  senders?: '*' | string[]

  /**
   * An optional array with the events to deliver.
   * Use '*' for all.
   */
  events?: '*' | XcmNotificationType[]

  /**
   * Historical Query.
   *
   * Enables backfilling historical data up to the server's retention limit in your subscription.
   *
   * Modes:
   * - `"last"`: Retrieves the last N data points and continues the real-time stream.
   * - `"timeframe"`: Supports open or closed time frames using relative time expressions or explicity start and end dates.
   *
   * Relative timeframe format: `{rel}_{n}_{units}`
   * - `{rel}`: "this" (includes events up to now) or "previous" (includes only complete time chunks).
   * - `{n}`: A positive integer.
   * - `{units}`: "minutes", "hours", "days", "weeks", "months", or "years".
   *
   * `"this"` keeps the stream open for real-time updates, while `"previous"` closes it at the end.
   */
  history?: {
    timeframe?: string | Partial<{ end: string | number; start: string | number }>
    last?: number
  }
}

type XcmMessage = Message<{
  type: XcmNotificationType
}>

/**
 * Guard condition for XcmSent.
 *
 * @public
 */
export function isXcmSent(message: XcmMessage): message is Message<XcmSent> {
  return message.payload !== undefined && message.payload.type === 'xcm.sent'
}

/**
 * Guard condition for XcmReceived.
 *
 * @public
 */
export function isXcmReceived(message: XcmMessage): message is Message<XcmReceived> {
  return message.payload !== undefined && message.payload.type === 'xcm.received'
}

/**
 * Guard condition for XcmRelayed.
 *
 * @public
 */
export function isXcmRelayed(message: XcmMessage): message is Message<XcmRelayed> {
  return message.payload !== undefined && message.payload.type === 'xcm.relayed'
}

/**
 * Guard condition for XcmHop.
 *
 * @public
 */
export function isXcmHop(message: XcmMessage): message is Message<XcmHop> {
  return message.payload !== undefined && message.payload.type === 'xcm.hop'
}

/**
 * Guard condition for XcmTimeout.
 *
 * @public
 */
export function isXcmTimeout(message: XcmMessage): message is Message<XcmTimeout> {
  return message.payload !== undefined && message.payload.type === 'xcm.timeout'
}
