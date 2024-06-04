import { Operation } from 'rfc6902'
import { z } from 'zod'

import { PublisherHub } from '../egress/hub.js'
import { PublisherEvents } from '../egress/types.js'
import { IngressConsumer } from '../ingress/index.js'
import { Janitor } from '../persistence/janitor.js'
import { Scheduler } from '../persistence/scheduler.js'
import { PublicationListener, Subscription } from '../subscriptions/types.js'
import { DB, Logger } from '../types.js'

export const $AgentId = z
  .string({
    required_error: 'agent id is required',
  })
  .min(1)
  .max(100)
  .regex(/[A-Za-z0-9.\-_]+/)

export type AgentId = z.infer<typeof $AgentId>

/**
 * The services provided by the runtime to the agents.
 */
export type AgentRuntimeContext = {
  log: Logger
  egress: PublisherHub
  ingress: IngressConsumer
  db: DB
  scheduler: Scheduler
  janitor: Janitor
}

/**
 *
 */
export interface AgentCatalog {
  addPublicationListener(eventName: keyof PublisherEvents, listener: PublicationListener): PublisherHub
  removePublicationListener(eventName: keyof PublisherEvents, listener: PublicationListener): PublisherHub
  getAgentById<A extends Agent = Agent>(agentId: AgentId): A
  getAgentInputSchema(agentId: AgentId): z.ZodSchema
  getAgentIds(): AgentId[]
  startAgent(agentId: AgentId, subscriptions?: Subscription[]): Promise<void>
  stop(): Promise<void>
  collectTelemetry(): void
}

/**
 *
 */
export type AgentMetadata = {
  name: string
  description?: string
}

/**
 *
 */
export type SubscriptionHandler = {
  subscription: Subscription
}

/**
 *
 */
export interface Agent {
  get id(): AgentId
  get metadata(): AgentMetadata
  get inputSchema(): z.ZodSchema
  subscribe(subscription: Subscription): Promise<void> | void
  unsubscribe(subscriptionId: string): Promise<void> | void
  update(subscriptionId: string, patch: Operation[]): Promise<Subscription> | Subscription
  stop(): Promise<void> | void
  start(subscriptions: Subscription[]): Promise<void> | void
  collectTelemetry(): Promise<void> | void
}
