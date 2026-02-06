import { sourceTransfers } from '../server-types'

/**
 * @public
 */
export type EnrichedTransfer = sourceTransfers.EnrichedTransfer

/**
 * @public
 */
export type IcTransferResponse = sourceTransfers.IcTransferResponse

/**
 * @public
 */
export type IcTransferQueryArgs = sourceTransfers.IcTransferQueryArgs

/**
 * @public
 */
export type TransfersAgentInputs = {
  /**
   * An array of network ids or '*' for all.
   */
  networks: '*' | string[]
}
