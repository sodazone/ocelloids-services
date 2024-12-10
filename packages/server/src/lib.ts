/**
 * Export types for client libraries.
 */

export type {
  HexString,
  SignerData,
  SubscriptionId,
} from './services/subscriptions/types.js'
export type { AnyJson, NetworkURN } from './services/types.js'
export type {
  AgentId,
  QueryParams,
  QueryResult,
  QueryPagination,
  AnyQueryArgs,
  AnyQueryResultItem,
} from './services/agents/types.js'
export type { Message } from './services/egress/types.js'
// TODO remove
export type { NetworkInfo } from './services/networking/substrate/ingress/types.js'

// ====================================================================
// Agent-specific support types
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
