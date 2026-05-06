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
  sourceIssuance,
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

export { CrosschainAgentApi } from './crosschain/agent'
export { crosschain }

import * as transfers from './transfers/types'

export { TransfersAgentApi } from './transfers/agent'
export { transfers }

import * as issuance from './issuance/types'

export { CrosschainIssuanceAgentApi } from './issuance/agent'
export { issuance }

import * as opengov from './opengov/types'

export { opengov }

import * as defi from './defi/types'

export { defi }
