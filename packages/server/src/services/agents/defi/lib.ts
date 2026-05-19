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
  protocols?: '*' | string[]
}

/**
 * @public
 */
export type EventFilters = {
  events?: '*' | DefiEventName[]
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

/**
 * @public
 */
export type DefiAgentQueryArgs =
  | {
      op: 'liquidity.last'
      criteria: {
        networks?: '*' | NetworkURN[]
      }
    }
  | {
      op: 'events'
      criteria?: {
        networks?: '*' | NetworkURN[]
        filters?: EventFilters
      }
    }
