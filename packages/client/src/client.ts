import { type MessageEvent, WebSocket } from 'isows'

import type { NotifyMessage } from './server-types'
import {
  AnySubscriptionInputs,
  type AuthReply,
  type MessageHandler,
  type OnDemandSubscription,
  type OnDemandSubscriptionHandlers,
  type Subscription,
  type SubscriptionError,
  type SubscriptionIds,
  type WebSocketHandlers,
  WsAuthErrorEvent,
  isSubscription,
  isSubscriptionError,
  isSubscriptionIds,
} from './types'

/**
 * The Ocelloids client configuration.
 *
 * @public
 */
export type OcelloidsClientConfig = {
  wsUrl: string
  httpUrl: string
  httpAuthToken?: string
  wsAuthToken?: string
}

/**
 * Type guard to check if a value is a Blob.
 *
 * @param value - The value to check.
 * @returns whether the value is a Blob.
 */
function isBlob(value: any): value is Blob {
  if (typeof Blob === 'undefined') {
    return false
  }
  return value instanceof Blob || Object.prototype.toString.call(value) === '[object Blob]'
}

/**
 * Protocol class to chain request response until reach streaming state.
 */
class Protocol {
  readonly #queue: MessageHandler<any>[] = []
  readonly #stream: MessageHandler<NotifyMessage>
  #isStreaming: boolean

  /**
   * Constructs a Protocol instance.
   * @param stream - The message handler for streaming state.
   */
  constructor(stream: MessageHandler<NotifyMessage>) {
    this.#stream = stream
    this.#isStreaming = false
  }

  /**
   * Adds a handler to the message queue.
   * @template T - The type of the message.
   * @param handler - The message handler to add.
   */
  next<T>(handler: MessageHandler<T>) {
    this.#queue.push(handler)
  }

  /**
   * Handles a WebSocket message event.
   * @param event - The message event to handle.
   */
  handle(event: MessageEvent) {
    const ws = event.target as WebSocket
    let current: MessageHandler<any>

    if (this.#isStreaming) {
      current = this.#stream
    } else {
      const next = this.#queue.pop()
      if (next) {
        current = next
      } else {
        current = this.#stream
        this.#isStreaming = true
      }
    }

    if (isBlob(event.data)) {
      ;(event.data as Blob).text().then((blob) => current(JSON.parse(blob), ws, event))
    } else {
      current(JSON.parse(event.data.toString()), ws, event)
    }
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
 * ```
 * @example Persistent long-lived subscription
 *
 * ```typescript
 * // create a 'long-lived' subscription
 * const reply = await client.create<xcm.XcmSubscriptionInputs>({
 *   id: "my-subscription",
 *   agent: "xcm",
 *   args: {
 *     origin: "urn:ocn:polkadot:2004",
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
 * const ws = client.subscribe("my-subscription", {
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
 * @example On-demand subscription
 *
 * ```typescript
 * // subscribe on-demand
 * const ws = client.subscribe<xcm.XcmSubscriptionInputs>({
 *   agent: "xcm",
 *   args: {
 *     origin: "urn:ocn:polkadot:2004",
 *     senders: "*",
 *     events: "*",
 *     destinations: [
 *       "urn:ocn:polkadot:0",
 *       "urn:ocn:polkadot:1000",
 *       "urn:ocn:polkadot:2000",
 *       "urn:ocn:polkadot:2034",
 *       "urn:ocn:polkadot:2104"
 *     ]
 *   }
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
 * @public
 */
export class OcelloidsClient {
  readonly #config: OcelloidsClientConfig
  readonly #headers: NonNullable<unknown>

  /**
   * Constructs an OcelloidsClient instance.
   *
   * @param config - The configuration for the client.
   */
  constructor(config: OcelloidsClientConfig) {
    this.#config = config

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }
    if (config.httpAuthToken) {
      headers['Authorization'] = `Bearer ${config.httpAuthToken}`
    }

    this.#headers = headers
  }

  /**
   * Creates a subscription.
   *
   * @param subscription - The subscription to create.
   * @param init - The fetch request init.
   * @returns A promise that resolves when the subscription is created.
   */
  async create<T = AnySubscriptionInputs>(subscription: Subscription<T>, init: RequestInit = {}) {
    return this.#fetch(this.#config.httpUrl + '/subs', {
      ...init,
      method: 'POST',
      body: JSON.stringify(subscription),
    })
  }

  /**
   * Gets a subscription by its identifier.
   *
   * @param subscriptionId - The subscription identifier.
   * @param init - The fetch request init.
   * @returns A promise that resolves with the subscription or rejects if not found.
   */
  async getSubscription<T = AnySubscriptionInputs>(
    subscriptionId: string,
    init?: RequestInit
  ): Promise<Subscription<T>> {
    return this.#fetch(this.#config.httpUrl + '/subs/' + subscriptionId, init)
  }

  /**
   * Lists all subscriptions.
   *
   * @param init - The fetch request init.
   * @returns A promise that resolves with an array of subscriptions.
   */
  async allSubscriptions(init?: RequestInit): Promise<Subscription[]> {
    return this.#fetch(this.#config.httpUrl + '/subs', init)
  }

  /**
   * Checks the health of the service.
   *
   * @param init - The fetch request init.
   * @returns A promise that resolves with the health status.
   */
  async health(init?: RequestInit): Promise<any> {
    return this.#fetch(this.#config.httpUrl + '/health', init)
  }

  /**
   * Creates an on-demand subscription or connects to an existing one.
   *
   * @param subscription - The subscription id or the subscription object to create.
   * @param handlers - The WebSocket event handlers.
   * @param onDemandHandlers - The on-demand subscription handlers.
   * @returns A promise that resolves with the WebSocket instance.
   */
  subscribe<T = AnySubscriptionInputs>(
    subscription: SubscriptionIds | OnDemandSubscription<T>,
    handlers: WebSocketHandlers,
    onDemandHandlers?: OnDemandSubscriptionHandlers
  ): WebSocket {
    const url = this.#config.wsUrl + '/ws/subs'

    return isSubscriptionIds(subscription)
      ? this.#openWebSocket<T>(`${url}/${subscription.agentId}/${subscription.subscriptionId}`, handlers)
      : this.#openWebSocket<T>(url, handlers, {
          sub: subscription,
          onDemandHandlers,
        })
  }

  #fetch<T>(url: string, init?: RequestInit) {
    return new Promise<T>((resolve, reject) => {
      fetch(url, {
        headers: this.#headers,
        ...init,
      })
        .then((res) => {
          if (res.ok) {
            res.json().then((j) => {
              resolve(j as T)
            })
          } else {
            res
              .json()
              .then(reject)
              .catch((_) => {
                if (res.body === null || res.body.locked) {
                  reject({
                    status: res.status,
                    statusText: res.statusText,
                  })
                } else {
                  res.text().then(reject)
                }
              })
          }
        })
        .catch(reject)
    })
  }

  #openWebSocket<T = AnySubscriptionInputs>(
    url: string,
    { onMessage, onAuthError, onError, onClose }: WebSocketHandlers,
    onDemandSub?: {
      sub: OnDemandSubscription<T>
      onDemandHandlers?: OnDemandSubscriptionHandlers
    }
  ) {
    const protocol = new Protocol(onMessage)
    const ws = new WebSocket(url)

    ws.onmessage = protocol.handle.bind(protocol)

    if (onError) {
      ws.onerror = onError
    }

    if (onClose) {
      ws.onclose = onClose
    }

    function requestOnDemandSub() {
      if (onDemandSub === undefined) {
        throw new Error('on demand subscription must be defined')
      }
      const { sub, onDemandHandlers } = onDemandSub

      ws.send(JSON.stringify(sub))

      protocol.next<Subscription | SubscriptionError>((msg) => {
        if (onDemandHandlers?.onSubscriptionCreated && isSubscription(msg)) {
          onDemandHandlers.onSubscriptionCreated(msg)
        } else if (onDemandHandlers?.onSubscriptionError && isSubscriptionError(msg)) {
          onDemandHandlers.onSubscriptionError(msg)
        } else if (onDemandHandlers?.onError) {
          onDemandHandlers.onError(msg)
        }
      })
    }

    ws.onopen = () => {
      if (ws.readyState !== 1) {
        ws.dispatchEvent(new Event('error'))
        return
      }

      if (this.#config.wsAuthToken) {
        ws.send(this.#config.wsAuthToken)
        protocol.next<AuthReply>((reply, _ws, event) => {
          if (reply.error) {
            if (onAuthError) {
              onAuthError(reply, _ws, event)
            } else {
              _ws.dispatchEvent(new WsAuthErrorEvent(reply))
            }
          } else if (onDemandSub) {
            requestOnDemandSub()
          }
        })
      } else if (onDemandSub) {
        requestOnDemandSub()
      }
    }

    return ws
  }
}
