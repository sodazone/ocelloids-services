import { Options } from 'ky'

import type {
  AgentId,
  AnyJson,
  AnyQueryArgs,
  AnyQueryResultItem,
  QueryPagination,
  QueryParams,
  QueryResult,
  SubscriptionId,
} from './lib'
import { type FetchFn, doFetchWithConfig, openWebSocket } from './transport'
import {
  type AnySubscriptionInputs,
  type OnDemandSubscriptionHandlers,
  type Subscription,
  type WebSocketHandlers,
} from './types'

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
 * Guard condition for {@link AnySubscriptionInputs}.
 *
 * Only to discriminate between subscription id and input.
 *
 * @private
 */
function isAnySubscriptionInputs(object: any): object is AnySubscriptionInputs {
  return typeof object === 'object'
}

// Default public endpoints
const API_WS_URL = 'wss://api.ocelloids.net'
const API_HTTP_URL = 'https://api.ocelloids.net'

/**
 * @public
 */
export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  hooks?: any
  body?: unknown
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
export type SseOptions<P extends Record<string, any> = Record<string, any>> = { streamName: string; args: P }

/**
 * Streamable Agent API.
 *
 * @public
 */
export interface StreamableApi<
  S extends SseOptions = { streamName: 'default'; args: Record<string, any> },
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

function toKyOptions(ops?: RequestOptions): Options {
  if (ops === undefined) {
    return {}
  }

  let body: BodyInit | undefined

  if (ops.body !== undefined && ops.body !== null) {
    if (typeof ops.body === 'string') {
      body = ops.body
    } else if (
      ops.body instanceof FormData ||
      ops.body instanceof URLSearchParams ||
      ops.body instanceof Blob
    ) {
      body = ops.body
    } else {
      body = JSON.stringify(ops.body)
    }
  }

  return {
    method: ops.method,
    headers: ops.headers,
    hooks: ops.hooks,
    body,
  }
}

/**
 * Exposes the Ocelloids Agent API.
 *
 * @public
 */
export class OcelloidsAgentApi<T>
  implements SubscribableApi<T>, QueryableApi, StreamableApi, OcelloidsClientApi
{
  readonly #agentId: AgentId
  readonly #config: Required<OcelloidsClientConfig>
  readonly #fetch: FetchFn
  readonly #client: OcelloidsClientApi

  constructor(config: Required<OcelloidsClientConfig>, agentId: AgentId, clientApi: OcelloidsClientApi) {
    this.#agentId = agentId
    this.#config = config
    this.#fetch = doFetchWithConfig(config)
    this.#client = clientApi
  }

  networks(options?: RequestOptions): Promise<Record<string, string[]>> {
    return this.#client.networks(options)
  }

  health(options?: RequestOptions): Promise<HealthResponse> {
    return this.#client.health(options)
  }

  async stream(opts: SseOptions, handler: SseHandler) {
    if (typeof EventSource === 'undefined') {
      throw new Error('EventSource is not supported in this environment')
    }

    if (this.#config.apiKey == null) {
      throw new Error('You need an API key')
    }

    const streamName = opts.streamName ?? 'default'
    const sseUrl = `${this.#config.httpUrl}/sse/${this.#agentId}/${streamName}`
    const sseNodUrl = `${this.#config.httpUrl}/sse/nod/${this.#agentId}/${streamName}`

    const requestNodToken = async () => {
      const { token } = await this.#fetch<{ token: string }>(sseNodUrl)
      if (!token) {
        throw new Error('Failed to get NOD token')
      }
      return token
    }

    const buildSseUrl = async () => {
      const nodToken = await requestNodToken()
      const params = opts.args
      params.nod = nodToken
      const query = new URLSearchParams(params).toString()
      return `${sseUrl}?${query}`
    }

    const finalUrl = await buildSseUrl()
    const source = new EventSource(finalUrl)

    if (handler.onError) {
      source.onerror = handler.onError
    }

    if (handler.onOpen) {
      source.onopen = handler.onOpen
    }

    for (const { event, onData } of handler.listeners) {
      source.addEventListener(event, (e) => onData(e.data))
    }

    return source
  }

  /**
   * Executes a query on the specified agent.
   *
   * @param args - The query arguments.
   * @param pagination - The pagination configuration.
   * @param options - The ky request options (fetch compatible).
   * @returns A promise that resolves to the results of the query.
   */
  async query<P = AnyQueryArgs, R = AnyQueryResultItem>(
    args: P,
    pagination?: QueryPagination,
    options?: RequestOptions,
  ) {
    const url = this.#config.httpUrl + '/query/' + this.#agentId
    return this.#fetch<QueryResult<R>>(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify({
        args,
        pagination,
      } as QueryParams),
    })
  }

  /**
   * Creates a subscription.
   *
   * @param subscription - The subscription to create.
   * @param options - The ky request options (fetch compatible)
   * @returns A promise that resolves when the subscription is created.
   */
  async createSubscription(subscription: Omit<Subscription<T>, 'agent'>, options?: RequestOptions) {
    return this.#fetch(this.#config.httpUrl + '/subs', {
      ...toKyOptions(options),
      method: 'POST',
      body: JSON.stringify({
        ...subscription,
        agent: this.#agentId,
      }),
    })
  }

  /**
   * Deletes a subscription.
   *
   * @param id - The subscription ID.
   * @param options - The ky request options (fetch compatible)
   */
  async deleteSubscription(id: string, options?: RequestOptions) {
    const url = `${this.#config.httpUrl}/subs/${this.#agentId}/${id}`
    return this.#fetch(url, {
      ...toKyOptions(options),
      method: 'DELETE',
    })
  }

  /**
   * Gets a subscription by its ID.
   *
   * @param id - The subscription ID.
   * @param options - The ky request options (fetch compatible)
   * @returns A promise that resolves with the subscription or rejects if not found.
   */
  async getSubscription(id: string, options?: RequestOptions): Promise<Subscription<T>> {
    const url = `${this.#config.httpUrl}/subs/${this.#agentId}/${id}`
    return this.#fetch<Subscription<T>>(url, toKyOptions(options))
  }

  /**
   * Lists all subscriptions.
   *
   * @param options - The ky request options (fetch compatible)
   * @returns A promise that resolves with an array of subscriptions.
   */
  async allSubscriptions(options?: RequestOptions): Promise<Subscription<T>[]> {
    return this.#fetch<Subscription<T>[]>(
      this.#config.httpUrl + '/subs/' + this.#agentId,
      toKyOptions(options),
    )
  }

  /**
   * Creates an on-demand subscription or connects to an existing one.
   *
   * @param subscription - The subscription id or the subscription inputs.
   * @param handlers - The WebSocket event handlers.
   * @param onDemandHandlers - The on-demand subscription handlers.
   * @returns A promise that resolves with the WebSocket instance.
   */
  async subscribe<P = AnyJson>(
    subscription: SubscriptionId | T,
    handlers: WebSocketHandlers<P>,
    onDemandHandlers?: OnDemandSubscriptionHandlers<T>,
  ): Promise<WebSocket> {
    const baseUrl = this.#config.wsUrl + '/ws/subs'

    return isAnySubscriptionInputs(subscription)
      ? openWebSocket<T, P>(this.#config, await this.#withToken(baseUrl), handlers, {
          sub: {
            args: subscription as any,
            ephemeral: true,
            agent: this.#agentId,
          },
          onDemandHandlers,
        })
      : openWebSocket<T, P>(
          this.#config,
          await this.#withToken(`${baseUrl}/${this.#agentId}/${subscription}`),
          handlers,
        )
  }

  async #withToken(base: string) {
    if (this.#config.apiKey) {
      const nod = await this.#requestNodToken()
      return base + '?nod=' + nod.token
    }
    return base
  }

  async #requestNodToken() {
    return await this.#fetch<{
      token: string
    }>(this.#config.httpUrl + '/ws/nod')
  }
}

/**
 * The Ocelloids client.
 *
 * @example Create a client instance
 *
 * ```typescript
 * import { OcelloidsClient, xcm } from "@sodazone/ocelloids-client";
 *
 * const client = new OcelloidsClient({
 *   httpUrl: "http://127.0.0.1:3000",
 *   wsUrl: "ws://127.0.0.1:3000"
 * });
 *
 * const agent = client.agent<xcm.XcmInputs>("xcm");
 * ```
 * @example Persistent long-lived subscription
 *
 * ```typescript
 * // create a 'long-lived' subscription
 * const reply = await agent.createSubscription({
 *   id: "my-subscription",
 *   args: {
 *     origins: ["urn:ocn:polkadot:2004"],
 *     senders: "*",
 *     events: "*",
 *     destinations: [
 *       "urn:ocn:polkadot:0",
 *       "urn:ocn:polkadot:1000",
 *       "urn:ocn:polkadot:2000",
 *       "urn:ocn:polkadot:2034",
 *       "urn:ocn:polkadot:2104"
 *     ],
 *   },
 *   channels: [
 *     {
 *       type: "webhook",
 *       url: "https://some.webhook"
 *     },
 *     {
 *       type: "websocket"
 *     }
 *   ]
 * });
 *
 * // subscribe to the previously created subscription
 * const ws = agent.subscribe(
 *  "my-subscription",
 *  {
 *    onMessage: msg => {
 *      if(xcm.isXcmReceived(msg)) {
 *        console.log("RECV", msg.subscriptionId);
 *      } else if(xcm.isXcmSent(msg)) {
 *        console.log("SENT", msg.subscriptionId)
 *      }
 *      console.log(msg);
 *    },
 *    onError: error => console.log(error),
 *    onClose: event => console.log(event.reason)
 * });
 * ```
 *
 * @example On-demand subscription
 *
 * ```typescript
 * // subscribe on-demand
 * const ws = agent.subscribe({
 *   origins: ["urn:ocn:polkadot:2004"],
 *   senders: "*",
 *   events: "*",
 *   destinations: [
 *     "urn:ocn:polkadot:0",
 *     "urn:ocn:polkadot:1000",
 *     "urn:ocn:polkadot:2000",
 *     "urn:ocn:polkadot:2034",
 *     "urn:ocn:polkadot:2104"
 *   ]
 * }, {
 *  onMessage: msg => {
 *    if(xcm.isXcmReceived(msg)) {
 *      console.log("RECV", msg.subscriptionId);
 *    } else if(xcm.isXcmSent(msg)) {
 *      console.log("SENT", msg.subscriptionId)
 *    }
 *    console.log(msg);
 *  },
 *  onError: error => console.log(error),
 *  onClose: event => console.log(event.reason)
 * });
 * ```
 *
 * @public
 */
export class OcelloidsClient implements OcelloidsClientApi {
  readonly #config: Required<OcelloidsClientConfig>
  readonly #fetch: FetchFn

  /**
   * Constructs an OcelloidsClient instance.
   *
   * @param config - The configuration for the client.
   */
  constructor(config: OcelloidsClientConfig) {
    this.#config = {
      wsUrl: config.wsUrl ?? API_WS_URL,
      httpUrl: config.httpUrl ?? API_HTTP_URL,
      apiKey: config.apiKey ?? null,
    }
    this.#fetch = doFetchWithConfig(this.#config)
  }

  /**
   * Creates an {@link OcelloidsAgentApi} instance for a specific agent.
   *
   * @public
   * @param agentId - The ID of the agent.
   * @returns An instance of OcelloidsAgentApi for the specified agent.
   */
  agent<T = AnySubscriptionInputs>(agentId: AgentId) {
    return new OcelloidsAgentApi<T>(this.#config, agentId, this)
  }

  /**
   * Fetches the list of configured network identifiers (URNs) from the server.
   *
   * @public
   * @param options - The ky request options (fetch compatible)
   * @returns A promise that resolves to an array of network URNs as strings.
   */
  async networks(options?: RequestOptions): Promise<Record<string, string[]>> {
    return this.#fetch(this.#config.httpUrl + '/ingress/networks', toKyOptions(options))
  }

  /**
   * Checks the health of the service.
   *
   * @public
   * @param options - The ky request options (fetch compatible)
   * @returns A promise that resolves with the health status.
   */
  async health(options?: RequestOptions): Promise<HealthResponse> {
    return this.#fetch(this.#config.httpUrl + '/health', toKyOptions(options))
  }
}
