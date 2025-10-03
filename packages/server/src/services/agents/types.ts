import { IncomingMessage } from 'node:http'
import { DuckDBInstance } from '@duckdb/node-api'
import { FastifyReply } from 'fastify'
import { Operation } from 'rfc6902'
import { z } from 'zod'

import { Egress } from '@/services/egress/hub.js'
import { PublisherEvents } from '@/services/egress/types.js'
import { Janitor } from '@/services/scheduling/janitor.js'
import { Scheduler } from '@/services/scheduling/scheduler.js'
import { EgressMessageListener, Subscription } from '@/services/subscriptions/types.js'
import { LevelDB, Logger, OpenLevelDB } from '@/services/types.js'

import { AccountWithCaps } from '../accounts/types.js'
import { ArchiveRepository } from '../archive/repository.js'
import { ArchiveRetentionOptions } from '../archive/types.js'
import { IngressConsumers } from '../ingress/consumer/types.js'
import { createServerSideEventsBroadcaster } from './api/sse.js'

/**
 * Schema for validating Agent IDs.
 */
export const $AgentId = z
  .string({
    required_error: 'agent id is required',
  })
  .min(1)
  .max(100)
  .regex(/[A-Za-z0-9.\-_]+/)

/**
 * Agent ID.
 *
 * @public
 */
export type AgentId = z.infer<typeof $AgentId>

/**
 * Services provided to agents.
 */
export type AgentRuntimeContext = {
  log: Logger
  egress: Egress
  ingress: IngressConsumers
  db: LevelDB
  openLevelDB: OpenLevelDB
  scheduler: Scheduler
  janitor: Janitor
  agentCatalog: AgentCatalog
  environment?: {
    dataPath?: string
  }
  archive?: ArchiveRepository
  archiveRetention?: ArchiveRetentionOptions
  analyticsDB?: DuckDBInstance
  config?: Record<string, any>
}

/**
 * Interface for managing agents.
 */
export interface AgentCatalog {
  /**
   * Adds a listener for egress message publishing.
   *
   * @param {keyof PublisherEvents} eventName - The name of the event to listen to
   * @param {EgressMessageListener} listener - The listener to add
   * @returns {Egress} The Egress instance
   */
  addEgressListener(eventName: keyof PublisherEvents, listener: EgressMessageListener): Egress

  /**
   * Removes a listener for egress message publishing.
   *
   * @param {keyof PublisherEvents} eventName - The name of the event to remove the listener from
   * @param {EgressMessageListener} listener - The listener to remove
   * @returns {Egress} The Egress instance
   */
  removeEgressListener(eventName: keyof PublisherEvents, listener: EgressMessageListener): Egress

  /**
   * Retrieves an agent by its ID.
   *
   * @param {AgentId} agentId - The ID of the agent to retrieve
   * @returns {A} The agent instance
   */
  getAgentById<A extends Agent = Agent>(agentId: AgentId): A

  /**
   * Gets the input schema for an agent.
   *
   * @param {AgentId} agentId - The ID of the agent
   * @returns {z.ZodSchema} The agent's input schema
   */
  getAgentInputSchema(agentId: AgentId): z.ZodSchema

  /**
   * Gets the query schema for an agent.
   *
   * @param {AgentId} agentId - The ID of the agent
   * @returns {z.ZodSchema} The agent's query schema
   */
  getAgentQuerySchema(agentId: AgentId): z.ZodSchema

  /**
   * Retrieves a subscribable agent by id.
   *
   * @param {AgentId} agentId - The ID of the agent to retrieve
   * @returns {A} The agent instance
   */
  getSubscribableById<A extends Agent & Subscribable = Agent & Subscribable>(agentId: AgentId): A

  /**
   * Retrieves a queryable agent by id.
   *
   * @param {AgentId} agentId - The ID of the agent to retrieve
   * @returns {A} The agent instance
   */
  getQueryableById<A extends Agent & Queryable = Agent & Queryable>(agentId: AgentId): A

  /**
   * Retrieves a streamable agent by id.
   *
   * @param {AgentId} agentId - The ID of the agent to retrieve
   * @returns {A} The agent instance
   */
  getStreamableById<A extends Agent & Streamable = Agent & Streamable>(agentId: AgentId): A

  /**
   * Gets a list of all agent IDs.
   *
   * @returns {AgentId[]} An array of agent IDs
   */
  getAgentIds(): AgentId[]

  /**
   * Starts an agent with optional subscriptions.
   *
   * @param {AgentId} agentId - The ID of the agent to start
   * @param {Subscription[]} [subscriptions] - Optional subscriptions to start with
   * @returns {Promise<void>} A promise that resolves when the agent is started
   */
  startAgent(agentId: AgentId, subscriptions?: Subscription[]): Promise<void>

  /**
   * Starts the AgentCatalog and all the non-subscribable agents.
   */
  start(): Promise<void>

  /**
   * Stops the AgentCatalog and all managed agents.
   *
   * @returns {Promise<void>} A promise that resolves when all agents are stopped
   */
  stop(): Promise<void>

  /**
   * Collects telemetry data from agents.
   */
  collectTelemetry(): void
}

/**
 * Capabilities of an agent.
 */
export type AgentCapabilities = {
  subscribable: boolean
  queryable: boolean
  streamable: boolean
}

/**
 * Metadata about an agent.
 */
export type AgentMetadata = {
  name: string
  capabilities: AgentCapabilities
  description?: string
}

/**
 * Handler for managing subscriptions.
 */
export type SubscriptionHandler = {
  subscription: Subscription
}

/**
 * Interface defining the capabilities needed to handle subscriptions.
 */
export interface Subscribable {
  /**
   * Gets the input schema used by the agent subscriptions.
   *
   * @returns {z.ZodSchema} The agent's input schema
   */
  get inputSchema(): z.ZodSchema

  /**
   * Subscribes to updates with a given subscription.
   *
   * @param {Subscription} subscription - The subscription to add
   * @param {AccountWithCaps} account - The requesting account
   * @returns {Promise<void> | void} A promise that resolves when the subscription is added, or void if synchronous
   */
  subscribe(subscription: Subscription, account?: AccountWithCaps): Promise<void> | void

  /**
   * Unsubscribes from updates using the subscription ID.
   *
   * @param {string} subscriptionId - The ID of the subscription to remove
   * @returns {Promise<void> | void} A promise that resolves when the subscription is removed, or void if synchronous
   */
  unsubscribe(subscriptionId: string): Promise<void> | void

  /**
   * Updates a subscription with a patch operation.
   *
   * @param {string} subscriptionId - The ID of the subscription to update
   * @param {Operation[]} patch - The patch operations to apply
   * @returns {Promise<Subscription> | Subscription} A promise that resolves with the updated subscription, or the updated subscription if synchronous
   */
  update(subscriptionId: string, patch: Operation[]): Promise<Subscription> | Subscription
}

/**
 * Generic query arguments.
 *
 * @public
 */
export type AnyQueryArgs = Record<string, any>

/**
 * Generic query result item.
 *
 * @public
 */
export type AnyQueryResultItem = Record<string, any>

/**
 * Query pagination options.
 *
 * @public
 */
export type QueryPagination = {
  cursor?: string
  limit?: number
}

/**
 * The query parameters.
 *
 * @public
 */
export type QueryParams<T = AnyQueryArgs> = {
  args: T
  pagination?: QueryPagination
}

/**
 * The query result.
 *
 * @public
 */
export type QueryResult<T = AnyQueryResultItem> = {
  items: T[]
  pageInfo?: {
    endCursor: string
    hasNextPage: boolean
  }
}

/**
 * Interface defining the capabilities needed to handle aggregated queries.
 */
export interface Queryable {
  querySchema: z.ZodSchema
  query(params: QueryParams): Promise<QueryResult<AnyQueryResultItem | unknown>>
}

export type ServerSideEventsRequest<T extends AnyQueryArgs = AnyQueryArgs> = {
  streamName: string
  filters: T
  request: IncomingMessage
  reply: FastifyReply
  uid?: string
}

export type ServerSideEventsConnection<T extends AnyQueryArgs = AnyQueryArgs> = {
  id: string
  filters: T
  request: IncomingMessage
  send: (event: ServerSideEvent) => void
  onDisconnect?: (connection: ServerSideEventsConnection<T>) => void
}

export type GenericEvent = { event: string; data: any }
export type ServerSideEvent<T extends GenericEvent = GenericEvent> = T

export type ServerSideEventsBroadcaster<
  T extends AnyQueryArgs = AnyQueryArgs,
  E extends GenericEvent = GenericEvent,
> = ReturnType<typeof createServerSideEventsBroadcaster<T, E>>

/**
 * Interface defining the capabilities needed to handle SSE.
 */
export interface Streamable<T extends AnyQueryArgs = AnyQueryArgs> {
  /**
   * Returns the Zod schema for filtering incoming event stream subscriptions.
   */
  get streamFilterSchema(): z.ZodSchema

  /**
   * Called by the HTTP server when server side events request.
   *
   * @param request - Info about the server side request (filters, metadata, etc.)
   */
  onServerSideEventsRequest(request: ServerSideEventsRequest<T>): void
}

/**
 * Interface defining the structure and behavior of an agent.
 */
export interface Agent {
  /**
   * Gets the unique identifier of the agent.
   *
   * @returns {AgentId} The agent's unique identifier
   */
  get id(): AgentId

  /**
   * Gets metadata about the agent.
   *
   * @returns {AgentMetadata} The agent's metadata
   */
  get metadata(): AgentMetadata

  /**
   * Stops the agent.
   *
   * @returns {Promise<void> | void} A promise that resolves when the agent is stopped, or void if synchronous
   */
  stop(): Promise<void> | void

  /**
   * Starts the agent with a list of subscriptions.
   *
   * @param {Subscription[] | undefined} subscriptions - The list of subscriptions to start with
   * @returns {Promise<void> | void} A promise that resolves when the agent is started, or void if synchronous
   */
  start(subscriptions?: Subscription[]): Promise<void> | void

  /**
   * Collects telemetry data from the agent.
   *
   * @returns {Promise<void> | void} A promise that resolves when telemetry is collected, or void if synchronous
   */
  collectTelemetry(): Promise<void> | void
}

/**
 * Subscribable guard condition.
 */
export function isSubscribable(object: any): object is Subscribable {
  return 'subscribe' in object
}

/**
 * Queryable guard condition.
 */
export function isQueryable(object: any): object is Queryable {
  return 'query' in object
}

/**
 * Streamable guard condition.
 */
export function isStreamable(object: any): object is Streamable {
  return 'onServerSideEventsRequest' in object
}

/**
 * Returns the agent capabilities based on the implemented interfaces.
 */
export function getAgentCapabilities(agent: Agent): AgentCapabilities {
  return {
    subscribable: isSubscribable(agent),
    queryable: isQueryable(agent),
    streamable: isStreamable(agent),
  }
}
