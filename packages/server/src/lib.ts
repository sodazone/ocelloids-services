/**
 * Export types for client libraries.
 */

export type {
  $AgentId,
  AgentId,
  AnyQueryArgs,
  AnyQueryResultItem,
  GenericEvent,
  QueryPagination,
  QueryParams,
  QueryResult,
  ServerSentEvent,
} from './services/agents/types.js'
export type { Message } from './services/egress/types.js'
export type {
  $SubscriptionId,
  HexString,
  SignerData,
  SubscriptionId,
} from './services/subscriptions/types.js'
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
 * XCM agent types
 */
// The "export * as ___" syntax is not supported yet; as a workaround,
// use "import * as ___" with a separate "export { ___ }" declaration
import * as xcm from './services/agents/xcm/lib.js'
export { xcm }

/**
 * Steward agent types
 */
import * as steward from './services/agents/steward/lib.js'
export { steward }

/**
 * Crosschain agent types
 */
import * as crosschain from './services/agents/crosschain/lib.js'
export { crosschain }
