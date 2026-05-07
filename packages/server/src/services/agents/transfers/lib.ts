import { NetworkURN } from '@/lib.js'
import { IcTransferType } from './types.js'

export { IcTransferResponse } from './repositories/types.js'

export {
  EnrichedTransfer,
  IcTransferType,
  Transfer,
} from './types.js'

/**
 * @public
 */
export type TransfersFilters = {
  types?: IcTransferType[]
  networks?: NetworkURN[]
  assets?: string[]
  address?: string
  txHash?: string
  usdAmountGte?: number
  usdAmountLte?: number
  sentAtGte?: number
  sentAtLte?: number
}

/**
 * @public
 */
export type TransferRangeFilters = {
  start?: number
  end?: number
  networks?: NetworkURN[]
}

/**
 * @public
 */
export type IcTransferQueryArgs =
  | { op: 'transfers.list'; criteria: TransfersFilters }
  | { op: 'transfers.by_id'; criteria: { id: number } }
  | { op: 'transfers.by_id_range'; criteria: TransferRangeFilters }
  | { op: 'networks.list' }
  | { op: 'assets.list' }

/**
 * @public
 */
export type TransfersAgentInputs = {
  networks: '*' | NetworkURN[]
}
