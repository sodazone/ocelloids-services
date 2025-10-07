import { sourceCrosschain } from '../server-types'

/**
 * @public
 */
export type XcQueryArgs = sourceCrosschain.XcQueryArgs

/**
 * @public
 */
export type XcServerSentEventArgs = sourceCrosschain.XcServerSentEventArgs

/**
 * @public
 */
export type FullJourneyResponse = sourceCrosschain.FullJourneyResponse

/**
 * @public
 */
export type ListAsset = sourceCrosschain.ListAsset

/**
 * @public
 */
export type XcQueryResponse = FullJourneyResponse | ListAsset
