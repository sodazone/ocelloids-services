import { NetworkURN } from '@/lib.js'
import { DefiEventName } from './types.js'

export type {
  DEFI_EVENT_NAMES,
  DefiEventAsset,
  DefiEventName,
  DefiEventPayload,
  DefiLiquidityAsset,
  DefiLiquidityPayload,
  DefiSubscriptionPayload,
} from './types.js'

/**
 * @public
 */
export type LiquidityFilters = {
  dex?: string[]
}

/**
 * @public
 */
export type EventFilters = {
  type?: DefiEventName
}

/**
 * @public
 */
export type DefiAgentInputs =
  | {
      topic: 'liquidity'
      networks: '*' | NetworkURN[]
      filters?: LiquidityFilters
    }
  | {
      topic: 'event'
      networks: '*' | NetworkURN[]
      filters?: EventFilters
    }
