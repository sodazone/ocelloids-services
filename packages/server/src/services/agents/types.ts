import { Operation } from 'rfc6902'
import { z } from 'zod'

import { IngressConsumer } from '../ingress/index.js'
import { NotifierHub } from '../notification/hub.js'
import { NotifierEvents } from '../notification/types.js'
import { Janitor } from '../persistence/janitor.js'
import { SubsStore } from '../persistence/subs.js'
import { NotificationListener, Subscription } from '../subscriptions/types.js'
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
  subsStore: SubsStore
  janitor: Janitor
}

export interface AgentService {
  addNotificationListener(eventName: keyof NotifierEvents, listener: NotificationListener): NotifierHub
  removeNotificationListener(eventName: keyof NotifierEvents, listener: NotificationListener): NotifierHub
  getAgentById(agentId: AgentId): Agent
  getAgentInputSchema(agentId: AgentId): z.ZodSchema
  getAgentIds(): AgentId[]
  start(): Promise<void>
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

export interface Agent<T extends SubscriptionHandler = SubscriptionHandler> {
  collectTelemetry(): void
  get id(): AgentId
  get metadata(): AgentMetadata
  getSubscriptionById(subscriptionId: string): Promise<Subscription>
  getAllSubscriptions(): Promise<Subscription[]>
  getInputSchema(): z.ZodSchema
  getSubscriptionDescriptor(subscriptionId: string): Subscription
  getSubscriptionHandler(subscriptionId: string): T
  subscribe(subscription: Subscription): Promise<void>
  unsubscribe(subscriptionId: string): Promise<void>
  update(subscriptionId: string, patch: Operation[]): Promise<Subscription>
  stop(): Promise<void>
  start(): Promise<void>
}
