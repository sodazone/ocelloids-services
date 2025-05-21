import { Subscription } from "@/services/subscriptions/types.js";
import { ZodType, ZodTypeDef } from "zod";
import { Operation } from "rfc6902";
import { Agent, AgentMetadata, AnyQueryResultItem, getAgentCapabilities, Queryable, QueryParams, QueryResult, Subscribable } from "../types.js";
import { $PriceWatcherQueryArgs } from "./types.js";

export class PriceWatcherAgent implements Agent, Queryable, Subscribable {
  id = 'steward'
  
  querySchema = $PriceWatcherQueryArgs

  metadata: AgentMetadata = {
    name: 'Data Steward',
    description: 'Aggregates and enriches cross-chain metadata for assets and currencies.',
    capabilities: getAgentCapabilities(this),
  }

  stop(): Promise<void> | void {
    throw new Error("Method not implemented.");
  }
  start(subscriptions?: Subscription[]): Promise<void> | void {
    throw new Error("Method not implemented.");
  }
  collectTelemetry(): Promise<void> | void {
    throw new Error("Method not implemented.");
  }
  query(params: QueryParams): Promise<QueryResult<AnyQueryResultItem | unknown>> {
    throw new Error("Method not implemented.");
  }
  get inputSchema(): ZodType<any, ZodTypeDef, any> {
    throw new Error("Method not implemented.");
  }
  subscribe(subscription: Subscription): Promise<void> | void {
    throw new Error("Method not implemented.");
  }
  unsubscribe(subscriptionId: string): Promise<void> | void {
    throw new Error("Method not implemented.");
  }
  update(subscriptionId: string, patch: Operation[]): Promise<Subscription> | Subscription {
    throw new Error("Method not implemented.");
  }
  
}