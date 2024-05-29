import { z } from 'zod'

import { Operation } from 'rfc6902'
import { AgentId, Subscription } from '../services/monitoring/types.js'

export interface AgentService {
  getAgentById(agentId: AgentId): Agent
  getAgentInputSchema(agentId: AgentId): z.ZodSchema
  getAgentIds(): AgentId[]
  start(): Promise<void>
  stop(): Promise<void>
}

export interface Agent {
  getSubscriptionById(subscriptionId: string): Promise<Subscription>
  getAllSubscriptions(): Promise<Subscription[]>
  getInputSchema(): z.ZodSchema
  get id(): AgentId
  getSubscriptionHandler(subscriptionId: string): Subscription
  subscribe(subscription: Subscription): Promise<void>
  unsubscribe(subscriptionId: string): Promise<void>
  update(subscriptionId: string, patch: Operation[]): Promise<Subscription>
  stop(): Promise<void>
  start(): Promise<void>
}
