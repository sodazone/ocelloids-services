import { type RequestOptions } from '../http/fetch'
import type {
  AgentId,
  AnyJson,
  AnyQueryArgs,
  AnyQueryResultItem,
  EventId,
  Message,
  MessageHandler,
  QueryPagination,
  QueryParams,
  QueryResult,
  SubscribeReplayContext,
  SubscriptionId,
} from '../lib'
import { type OnDemandSubscriptionHandlers, type Subscription, type WebSocketHandlers } from '../types'
import { doFetchWithConfig, type FetchFn, openWebSocket } from './transport'
import {
  HealthResponse,
  OcelloidsClientApi,
  OcelloidsClientConfig,
  QueryableApi,
  SseHandler,
  SseOptions,
  StreamableApi,
  SubscribableApi,
} from './types'
import { isGreaterThan, isGreaterThanOrEqual, isLessThanOrEqual, isSubscriptionInputs, sleep } from './utils'

/**
 * Exposes the Ocelloids Agent API.
 *
 * @public
 */
export class OcelloidsAgentApi<T, P = AnyJson>
  implements SubscribableApi<T, P>, QueryableApi, StreamableApi, OcelloidsClientApi
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

    const streamName = opts.streamName ?? 'default'
    const sseUrl = `${this.#config.httpUrl}/sse/${this.#agentId}/${streamName}`

    const encodeParams = (args: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(args).map(([key, val]) => {
          if (Array.isArray(val)) {
            return [key, val.join(',')]
          }
          return [key, String(val)]
        }),
      )

    const buildSseUrl = async () => {
      const params = encodeParams(opts.args)
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
      source.addEventListener(event, (e) => {
        try {
          onData(JSON.parse(e.data))
        } catch (err) {
          console.error(err)
        }
      })
    }

    return source
  }

  /**
   * Executes a query on the specified agent.
   *
   * @param args - The query arguments.
   * @param pagination - The pagination configuration.
   * @param options - The request options (fetch compatible).
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
   * @param options - The request options (fetch compatible)
   * @returns A promise that resolves when the subscription is created.
   */
  async createSubscription(subscription: Omit<Subscription<T>, 'agent'>, options?: RequestOptions) {
    return this.#fetch(this.#config.httpUrl + '/subs', {
      ...options,
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
   * @param options - The request options (fetch compatible)
   */
  async deleteSubscription(id: string, options?: RequestOptions) {
    const url = `${this.#config.httpUrl}/subs/${this.#agentId}/${id}`
    return this.#fetch(url, {
      ...options,
      method: 'DELETE',
    })
  }

  /**
   * Gets a subscription by its ID.
   *
   * @param id - The subscription ID.
   * @param options - The request options (fetch compatible)
   * @returns A promise that resolves with the subscription or rejects if not found.
   */
  async getSubscription(id: string, options?: RequestOptions): Promise<Subscription<T>> {
    const url = `${this.#config.httpUrl}/subs/${this.#agentId}/${id}`
    return this.#fetch<Subscription<T>>(url, options)
  }

  /**
   * Lists all subscriptions.
   *
   * @param options - The request options (fetch compatible)
   * @returns A promise that resolves with an array of subscriptions.
   */
  async allSubscriptions(options?: RequestOptions): Promise<Subscription<T>[]> {
    return this.#fetch<Subscription<T>[]>(this.#config.httpUrl + '/subs/' + this.#agentId, options)
  }

  /**
   * Creates an on-demand subscription or connects to an existing one.
   *
   * @param subscription - The subscription id or the subscription inputs.
   * @param handlers - The WebSocket event handlers.
   * @param onDemandHandlers - The on-demand subscription handlers.
   * @returns A promise that resolves with the WebSocket instance.
   */
  async subscribe(
    subscription: SubscriptionId | T,
    handlers: WebSocketHandlers<P>,
    onDemandHandlers?: OnDemandSubscriptionHandlers<T>,
  ): Promise<WebSocket> {
    const baseUrl = this.#config.wsUrl + '/ws/subs'

    return isSubscriptionInputs(subscription)
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

  protected async subscribeWithReplayStrategy<P extends { id: EventId } = { id: EventId }, Q = AnyQueryArgs>(
    subscription: SubscriptionId | T,
    handlers: WebSocketHandlers<P>,
    replayContext: SubscribeReplayContext,
    replayStrategy: {
      buildReplayQuery: (from?: EventId, to?: EventId) => { args: Q; pagination?: QueryPagination } | null
      buildReplayedMessageMetadata: (payload: P) => {
        type: string
        agentId: string
        networkId: string
        timestamp: number
        blockTimestamp?: number
      }
    },
    onDemandHandlers?: OnDemandSubscriptionHandlers<T>,
  ): Promise<WebSocket> {
    const baseUrl = this.#config.wsUrl + '/ws/subs'

    let firstLiveId: EventId
    let lastSeen: EventId =
      replayContext.lastSeenId ?? ((typeof replayContext.lastSeenId === 'number' ? 0 : '0') as EventId)
    let replayStarted = false
    let replayFailed = false

    const replayRange = async (ws: WebSocket, end?: EventId) => {
      replayStarted = true

      const replayQuery = replayStrategy.buildReplayQuery(lastSeen, end)
      if (replayQuery === null) {
        return
      }

      const { pagination, args } = replayQuery
      let cursor = pagination?.cursor

      try {
        // TODO: break if too many fetches without stop... (throttling?)
        do {
          const result = await this.query<Q, P>(args, cursor ? { cursor } : undefined)
          cursor = result.pageInfo?.hasNextPage ? result.pageInfo.endCursor : undefined

          for (const item of result.items) {
            if (lastSeen !== undefined && isLessThanOrEqual(item.id, lastSeen)) {
              continue
            }

            if (firstLiveId !== null && isGreaterThanOrEqual(item.id, firstLiveId)) {
              cursor = undefined
              break
            }

            lastSeen = item.id

            handlers.onMessage(
              { metadata: replayStrategy.buildReplayedMessageMetadata(item as any), payload: item } as any,
              ws,
              undefined as any,
            )

            if (firstLiveId === null) {
              await replayContext.onPersist(item.id)
            }
          }

          if (cursor) {
            // Basic dumb throttling, consider maybe token bucket rate limiter
            await sleep(500)
          }
        } while (cursor)
      } catch (err) {
        console.error(err, 'Failed to fetch replay range')
        replayFailed = true
        await replayContext.onIncompleteRange?.({
          from: lastSeen ?? null,
          to: end ?? null,
        })
      }

      if (!replayFailed) {
        replayContext.onCompleteRange?.()

        if (lastSeen !== undefined) {
          await replayContext.onPersist(lastSeen)
        }
      }
    }

    const wrappedOnMessage: MessageHandler<Message<P>> = async (message, ws) => {
      const msgId = message.payload.id
      if (firstLiveId === null) {
        firstLiveId = msgId
      }
      if (!replayStarted) {
        replayRange(ws, firstLiveId)
      }

      handlers.onMessage(message, ws, undefined as any)

      if (isGreaterThan(msgId, lastSeen)) {
        lastSeen = msgId
        await replayContext.onPersist(msgId)
      }
    }

    const ws = isSubscriptionInputs(subscription)
      ? openWebSocket<T, P>(
          this.#config,
          await this.#withToken(baseUrl),
          { ...handlers, onMessage: wrappedOnMessage },
          {
            sub: {
              args: subscription as any,
              ephemeral: true,
              agent: this.#agentId,
            },
            onDemandHandlers,
          },
        )
      : openWebSocket<T, P>(
          this.#config,
          await this.#withToken(`${baseUrl}/${this.#agentId}/${subscription}`),
          { ...handlers, onMessage: wrappedOnMessage },
        )

    queueMicrotask(() => {
      if (!replayStarted) {
        replayRange(ws)
      }
    })

    return ws
  }

  protected async resolveInputsFromSubscription(subscription: SubscriptionId | T) {
    return isSubscriptionInputs<T>(subscription)
      ? subscription
      : (await this.getSubscription(subscription)).args
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
