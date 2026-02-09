/**
 * A client library for Ocelloids Services.
 *
 * @see {@link OcelloidsClient} to get started.
 *
 * @packageDocumentation
 */
export * from './agent'
export * from './core/api'
export * from './core/client'
export * from './core/types'
export type { DoFetch, DoFetchOptions, RequestOptions } from './http/fetch'
export * from './query'
export type {
  $AgentId,
  $SubscriptionId,
  AgentId,
  AnyJson,
  AnyQueryArgs,
  AnyQueryResultItem,
  HexString,
  Message,
  NetworkURN,
  QueryPagination,
  QueryParams,
  QueryResult,
  SignerData,
  SubscriptionId,
  SubstrateTypes,
  sourceCrosschain,
  sourceSteward,
  sourceTransfers,
  sourceXcm,
} from './server-types'
export * from './types'

// The "export * as ___" syntax is not supported yet; as a workaround,
// use "import * as ___" with a separate "export { ___ }" declaration
import * as xcm from './xcm/types'
export { xcm }

import * as steward from './steward/types'
export { steward }

import * as crosschain from './crosschain/types'
export { crosschain }

export * from './transfers/agent'

import * as transfers from './transfers/types'
export { transfers }
