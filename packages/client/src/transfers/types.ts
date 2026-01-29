import { sourceTransfers } from '../server-types'

/**
 * @public
 */
export type EnrichedTransfer = sourceTransfers.EnrichedTransfer

/**
 * @public
 */
export type TransfersAgentInputs = {
  /**
   * An array of network ids or '*' for all.
   */
  networks: '*' | string[]
}
