import { z } from 'zod'

import { Operation } from 'rfc6902'

import { IngressConsumer } from '../services/ingress/index.js'
import { AgentId, NotificationListener, Subscription } from '../services/monitoring/types.js'
import { NotifierHub } from '../services/notification/hub.js'
import { NotifierEvents } from '../services/notification/types.js'
import { Janitor } from '../services/persistence/janitor.js'
import { SubsStore } from '../services/persistence/subs.js'
import { DB, Logger } from '../services/types.js'

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

export interface Agent {
  get id(): AgentId
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
