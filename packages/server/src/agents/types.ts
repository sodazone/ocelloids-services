import { AgentId, Subscription } from '../services/monitoring/types.js'

export interface AgentService {
  getAgentById(agentId: AgentId): Agent
  getAgentIds(): AgentId[]
  start(): Promise<void>
  stop(): Promise<void>
}

export interface Agent {
  get id(): AgentId
  getSubscriptionHandler(subscriptionId: string): Subscription
  subscribe(subscription: Subscription): Promise<void>
  // TODO
  // update(s: ):void
  unsubscribe(subscriptionId: string): Promise<void>
  stop(): Promise<void>
  start(): Promise<void>
}
