import { NetworkURN } from '@/lib.js'
import { DefiEventName } from './types.js'

export { DefiEventPayload, DefiLiquidityPayload, DefiSubscriptionPayload } from './types.js'

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
      topic: 'events'
      networks: '*' | NetworkURN[]
      filters?: EventFilters
    }
