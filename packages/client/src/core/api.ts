import { type RequestOptions } from '../http/fetch'
import type {
  AgentId,
  AnyJson,
  AnyQueryArgs,
  AnyQueryResultItem,
  Message,
  MessageHandler,
  QueryPagination,
  QueryParams,
  QueryResult,
  SubscriptionId,
} from '../lib'
import {
  type AnySubscriptionInputs,
  type OnDemandSubscriptionHandlers,
  type Subscription,
  type WebSocketHandlers,
} from '../types'
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

/**
 * Guard condition for {@link AnySubscriptionInputs}.
 *
 * Only to discriminate between subscription id and input.
 *
 * @internal
 */
export function _isAnySubscriptionInputs(object: any): object is AnySubscriptionInputs {
  return typeof object === 'object'
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
  async subscribe<P = AnyJson>(
    subscription: SubscriptionId | T,
    handlers: WebSocketHandlers<P>,
    onDemandHandlers?: OnDemandSubscriptionHandlers<T>,
  ): Promise<WebSocket> {
    const baseUrl = this.#config.wsUrl + '/ws/subs'

    return _isAnySubscriptionInputs(subscription)
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

  protected async subscribeWithReplayStrategy<
    P extends { id: number } = { id: number },
    Q = AnyQueryArgs,
    R extends { id: number } = { id: number },
  >(
    subscription: SubscriptionId | T,
    handlers: WebSocketHandlers<P>,
    replay: {
      lastSeenId?: number
      onPersist: (id: number) => Promise<void>
      onCompleteRange?: () => void
      onIncompleteRange?: (info: { from: number | null; to: number | null }) => Promise<void>
    },
    replayStrategy: {
      buildReplayQuery: (from?: number, to?: number) => Q | null
    },
    onDemandHandlers?: OnDemandSubscriptionHandlers<T>,
  ): Promise<WebSocket> {
    const baseUrl = this.#config.wsUrl + '/ws/subs'

    let firstLiveId: number | null = null
    let lastReplayed = replay.lastSeenId
    let replayStarted = false
    let replayFailed = false

    const replayRange = async (ws: WebSocket, end?: number) => {
      replayStarted = true

      const args = replayStrategy.buildReplayQuery(lastReplayed, end)
      if (!args) {
        return
      }

      let cursor: string | undefined

      try {
        do {
          const result = await this.query<Q, R>(args, cursor ? { cursor } : undefined)
          cursor = result.pageInfo?.hasNextPage ? result.pageInfo.endCursor : undefined

          for (const item of result.items) {
            if (lastReplayed !== undefined && item.id <= lastReplayed) {
              continue
            }
            if (firstLiveId !== null && item.id >= firstLiveId) {
              cursor = undefined
              break
            }

            lastReplayed = item.id
            handlers.onMessage({ payload: item } as any, ws, undefined as any)
            if (firstLiveId === null) {
              await replay.onPersist(item.id)
            }
          }
        } while (cursor)
      } catch (err) {
        console.error(err, 'Failed to fetch replay range')
        replayFailed = true
        await replay.onIncompleteRange?.({
          from: lastReplayed ?? null,
          to: end ?? null,
        })
      }

      if (!replayFailed) {
        replay.onCompleteRange?.()
      }
    }

    const wrappedOnMessage: MessageHandler<Message<P>> = async (message, ws) => {
      if (firstLiveId === null) {
        firstLiveId = message.payload.id
      }
      if (!replayStarted) {
        replayRange(ws, firstLiveId)
      }

      handlers.onMessage({ payload: message.payload } as any, ws, undefined as any)
      await replay.onPersist(message.payload.id)
    }

    const ws = _isAnySubscriptionInputs(subscription)
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

    queueMicrotask(async () => {
      if (!replayStarted) {
        await replayRange(ws)
      }
    })

    return ws
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
