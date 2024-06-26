/**
 * Export types for client libraries.
 */

export type {
  HexString,
  SignerData,
  SubscriptionId,
} from './services/subscriptions/types.js'
export type { AnyJson } from './services/types.js'
export type { AgentId } from './services/agents/types.js'
export type { Message } from './services/egress/types.js'

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
