import { z } from 'zod'

import { Operation } from 'rfc6902'

import { IngressConsumer } from '../ingress/index.js'
import { NotifierHub } from '../notification/hub.js'
import { NotifierEvents } from '../notification/types.js'
import { Janitor } from '../persistence/janitor.js'
import { SubsStore } from '../persistence/subs.js'
import { NotificationListener, Subscription } from '../subscriptions/types.js'
import { DB, Logger } from '../types.js'

export const $AgentId = z.string({
  required_error: 'agent id is required',
})

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
}

export type AgentMetadata = {
  id: AgentId
  name?: string
  description?: string
}

export interface Agent {
  get id(): AgentId
  get metadata(): AgentMetadata
  getSubscriptionById(subscriptionId: string): Promise<Subscription>
  getAllSubscriptions(): Promise<Subscription[]>
  getInputSchema(): z.ZodSchema
  getSubscriptionHandler(subscriptionId: string): Subscription
  subscribe(subscription: Subscription): Promise<void>
  unsubscribe(subscriptionId: string): Promise<void>
  update(subscriptionId: string, patch: Operation[]): Promise<Subscription>
  stop(): Promise<void>
  start(): Promise<void>
}
