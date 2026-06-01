/**
 * Export types for client libraries.
 */

export type {
  AnyQueryArgs,
  AnyQueryResultItem,
  GenericEvent,
  QueryPagination,
  QueryParams,
  QueryResult,
  ServerSentEvent,
} from './services/agents/types.js'

/**
 * @public
 */
export type AgentId = string

export type { Message } from './services/egress/types.js'
export type {
  HexString,
  SignerData,
} from './services/subscriptions/types.js'

/**
 * @public
 */
export type SubscriptionId = string

export type { AnyJson, NetworkURN } from './services/types.js'

// ====================================================================
// Network-specific types
// ====================================================================

/**
 * Substrate network types.
 * @public
 */
export * as SubstrateTypes from './services/networking/substrate/public-types.js'

// ====================================================================
// Agent-specific types
// NOTE: this will be extracted
// ====================================================================

/**
 * Crosschain agent types
 */
export * as crosschain from './services/agents/crosschain/lib.js'
/**
 * DeFi agent types
 */
export * as defi from './services/agents/defi/lib.js'
/**
 * Crosschain Issuance agent types
 */
export * as issuance from './services/agents/issuance/lib.js'
/**
 * Steward agent types
 */
export * as steward from './services/agents/steward/lib.js'
/**
 * Transfers agent types
 */
export * as transfers from './services/agents/transfers/lib.js'
/**
 * XCM agent types
 */
export * as xcm from './services/agents/xcm/lib.js'
