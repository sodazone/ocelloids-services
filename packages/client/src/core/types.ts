import { type RequestOptions } from '../http/fetch'
import type { AnyJson, QueryPagination, QueryResult, SubscriptionId } from '../lib'
import {
  type AnySubscriptionInputs,
  type OnDemandSubscriptionHandlers,
  type Subscription,
  type WebSocketHandlers,
} from '../types'

/**
 * The Ocelloids client configuration.
 *
 * @public
 */
export type OcelloidsClientConfig = {
  wsUrl?: string
  httpUrl?: string
  apiKey?: string | null
}

/**
 * The server health response.
 *
 * @public
 */
export type HealthResponse = {
  statusCode: number
  status: string
  uptime: number
}

/**
 * General client API.
 *
 * @public
 */
export interface OcelloidsClientApi {
  networks(options?: RequestOptions): Promise<Record<string, string[]>>
  health(options?: RequestOptions): Promise<HealthResponse>
}

/**
 * Subscribable Agent API.
 *
 * @public
 */
export interface SubscribableApi<T = AnySubscriptionInputs, P = AnyJson> {
  createSubscription(subscription: Omit<Subscription<T>, 'agent'>, options?: RequestOptions): Promise<unknown>
  deleteSubscription(id: string, options?: RequestOptions): Promise<unknown>
  getSubscription(id: string, options?: RequestOptions): Promise<Subscription<T>>
  allSubscriptions(options?: RequestOptions): Promise<Subscription<T>[]>
  subscribe(
    subscription: SubscriptionId | T,
    handlers: WebSocketHandlers<P>,
    onDemandHandlers?: OnDemandSubscriptionHandlers<T>,
  ): Promise<WebSocket>
}

/**
 * Queryable Agent API.
 *
 * @public
 */
export interface QueryableApi<P = AnyJson, R = AnyJson> {
  query(args: P, pagination?: QueryPagination, options?: RequestOptions): Promise<QueryResult<R>>
}

/**
 * Subscribable Agent with Replay + Query API.
 *
 * @public
 */
export interface SubscribableWithReplayApi<
  T = AnySubscriptionInputs,
  P extends { id: number } = { id: number },
  Q = AnyJson,
  R = AnyJson,
> extends SubscribableApi<T, P>,
    QueryableApi<Q, R> {
  /**
   * subscribeWithReplay emits historical and live events concurrently.
   *
   * Guarantees:
   * - No duplicate event IDs
   * - Live events are emitted immediately
   *
   * Non-guarantees:
   * - Strict ordering between replay and live
   * - Replay completion before live
   */
  subscribeWithReplay(
    subscription: SubscriptionId | T,
    handlers: WebSocketHandlers<P>,
    replayContext: {
      lastSeenId?: number
      onPersist: (id: number) => Promise<void>
      onCompleteRange: () => void
      onIncompleteRange: (range: { from: number | null; to: number | null }) => Promise<void>
    },
    onDemandHandlers?: OnDemandSubscriptionHandlers<T>,
  ): Promise<WebSocket>
}

/**
 * @public
 */
export type SseListener = { event: string; onData: (data: any) => void }

/**
 * SSE event handlers
 *
 * @public
 */
export interface SseHandler<L = SseListener> {
  listeners: L[]
  onError?: (error: Event | Error) => void
  onOpen?: (event: Event) => void
}

/**
 * @public
 */
export type SseArg = unknown | unknown[]

/**
 * @public
 */
export type SseOptions<P extends Record<string, SseArg> = Record<string, SseArg>> = {
  streamName: string
  args: P
}

/**
 * Streamable Agent API.
 *
 * @public
 */
export interface StreamableApi<
  S extends SseOptions = { streamName: 'default'; args: Record<string, SseArg> },
  L extends SseListener = SseListener,
> {
  stream(
    opts: S,
    handler: SseHandler<L>,
  ): Promise<{
    readyState: number
    close: () => void
  }>
}
