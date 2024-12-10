/**
 * A client library for Ocelloids Services.
 *
 * @see {@link OcelloidsClient} to get started.
 *
 * @packageDocumentation
 */
export * from './client'
export * from './types'
export type {
  SubscriptionId,
  AnyJson,
  HexString,
  Message,
  SignerData,
  AgentId,
  QueryParams,
  QueryResult,
  QueryPagination,
  AnyQueryArgs,
  NetworkURN,
  AnyQueryResultItem,
  NetworkInfo,
  sourceSteward,
  sourceXcm,
} from './server-types'

// The "export * as ___" syntax is not supported yet; as a workaround,
// use "import * as ___" with a separate "export { ___ }" declaration
import * as xcm from './xcm/types'
export { xcm }

import * as steward from './steward/types'
export { steward }
