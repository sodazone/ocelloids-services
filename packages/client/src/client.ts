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
  wsUrl: string
  httpUrl: string
  httpAuthToken?: string
  wsAuthToken?: string
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

/**
 * Exposes the Ocelloids Agent API.
 * 
 * @public
 */
export class OcelloidsAgentApi<T = AnySubscriptionInputs> {
  readonly #agentId: string
  readonly #config: OcelloidsClientConfig
  readonly #fetch: FetchFn

  constructor(config: OcelloidsClientConfig, agentId: string) {
    this.#agentId = agentId
    this.#config = config
    this.#fetch = doFetchWithConfig(config)
  }

  /**
   * Creates a subscription.
   *
   * @param subscription - The subscription to create.
   * @param init - The fetch request initialization.
   * @returns A promise that resolves when the subscription is created.
   */
  async create(subscription: Omit<Subscription<T>, 'agent'>, init: RequestInit = {}) {
    return this.#fetch(this.#config.httpUrl + '/subs', {
      ...init,
      method: 'POST',
      body: JSON.stringify({
        ...subscription,
        agent: this.#agentId,
      }),
    })
  }

  /**
   * Gets a subscription by its ID.
   *
   * @param id - The subscription ID.
   * @param init - The fetch request initialization.
   * @returns A promise that resolves with the subscription or rejects if not found.
   */
  async getSubscription(id: string, init?: RequestInit): Promise<Subscription<T>> {
    return this.#fetch<Subscription<T>>(`${this.#config.httpUrl}/subs/${this.#agentId}/${id}`, init)
  }

  /**
   * Lists all subscriptions.
   *
   * @param init - The fetch request initialization.
   * @returns A promise that resolves with an array of subscriptions.
   */
  async allSubscriptions(init?: RequestInit): Promise<Subscription<T>[]> {
    return this.#fetch<Subscription<T>[]>(this.#config.httpUrl + '/subs/' + this.#agentId, init)
  }

  /**
   * Creates an on-demand subscription or connects to an existing one.
   *
   * @param subscription - The subscription id or the subscription inputs.
   * @param handlers - The WebSocket event handlers.
   * @param onDemandHandlers - The on-demand subscription handlers.
   * @returns A promise that resolves with the WebSocket instance.
   */
  subscribe(
    subscription: string | T,
    handlers: WebSocketHandlers,
    onDemandHandlers?: OnDemandSubscriptionHandlers
  ): WebSocket {
    const url = this.#config.wsUrl + '/ws/subs'

    return isAnySubscriptionInputs(subscription)
      ? openWebSocket<T>(this.#config, url, handlers, {
          sub: {
            args: subscription,
            ephemeral: true,
            agent: this.#agentId,
          },
          onDemandHandlers,
        })
      : openWebSocket<T>(this.#config, `${url}/${this.#agentId}/${subscription}`, handlers)
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
 * const reply = await agent.create({
 *   id: "my-subscription",
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
 *   origin: "urn:ocn:polkadot:2004",
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
export class OcelloidsClient {
  readonly #config: OcelloidsClientConfig
  readonly #fetch: FetchFn

  /**
   * Constructs an OcelloidsClient instance.
   *
   * @param config - The configuration for the client.
   */
  constructor(config: OcelloidsClientConfig) {
    this.#config = config
    this.#fetch = doFetchWithConfig(config)
  }

  /**
   * Creates an {@link OcelloidsAgentApi} instance for a specific agent.
   *
   * @param agentId - The ID of the agent.
   * @returns An instance of OcelloidsAgentApi for the specified agent.
   */
  agent<T = AnySubscriptionInputs>(agentId: string) {
    return new OcelloidsAgentApi<T>(this.#config, agentId)
  }

  /**
   * Checks the health of the service.
   *
   * @param init - The fetch request initialization.
   * @returns A promise that resolves with the health status.
   */
  async health(init?: RequestInit): Promise<any> {
    return this.#fetch(this.#config.httpUrl + '/health', init)
  }
}
