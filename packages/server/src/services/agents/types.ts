import { Operation } from 'rfc6902'
import { z } from 'zod'

import { ControlQuery } from '@sodazone/ocelloids-sdk'
import { IngressConsumer } from '../ingress/index.js'
import { NotifierHub } from '../notification/hub.js'
import { NotifierEvents } from '../notification/types.js'
import { Janitor } from '../persistence/janitor.js'
import { NotificationListener, RxSubscriptionWithId, Subscription } from '../subscriptions/types.js'
import { DB, Logger } from '../types.js'

export const $AgentId = z
  .string({
    required_error: 'agent id is required',
  })
  .min(1)
  .max(100)
  .regex(/[A-Za-z0-9.\-_]+/)

export type AgentId = z.infer<typeof $AgentId>

export type AgentRuntimeContext = {
  log: Logger
  notifier: NotifierHub
  ingressConsumer: IngressConsumer
  rootStore: DB
  janitor: Janitor
}

export interface AgentCatalog {
  addNotificationListener(eventName: keyof NotifierEvents, listener: NotificationListener): NotifierHub
  removeNotificationListener(eventName: keyof NotifierEvents, listener: NotificationListener): NotifierHub
  getAgentById<A extends Agent = Agent>(agentId: AgentId): A
  getAgentInputSchema(agentId: AgentId): z.ZodSchema
  getAgentIds(): AgentId[]
  startAgent(agentId: AgentId, subscriptions?: Subscription[]): Promise<void>
  stop(): Promise<void>
  collectTelemetry(): void
}

export type AgentMetadata = {
  id: AgentId
  name?: string
  description?: string
}

export type SubscriptionHandler = {
  descriptor: Subscription
}

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
