import { type DoFetch, type RequestOptions } from '../http/fetch'
import type { AgentId } from '../lib'
import { type AnySubscriptionInputs } from '../types'
import { OcelloidsAgentApi } from './api'
import { doFetchWithConfig, type FetchFn } from './transport'
import { HealthResponse, OcelloidsClientApi, OcelloidsClientConfig } from './types'

// Default public endpoints
const API_WS_URL = 'wss://api.ocelloids.net'
const API_HTTP_URL = 'https://api.ocelloids.net'

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
  constructor(config: OcelloidsClientConfig, doFetch?: DoFetch) {
    this.#config = {
      wsUrl: config.wsUrl ?? API_WS_URL,
      httpUrl: config.httpUrl ?? API_HTTP_URL,
      apiKey: config.apiKey ?? null,
    }
    this.#fetch = doFetchWithConfig(this.#config, doFetch)
  }

  get config() {
    return this.#config
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
   * @param options - The request options (fetch compatible)
   * @returns A promise that resolves to an array of network URNs as strings.
   */
  async networks(options?: RequestOptions): Promise<Record<string, string[]>> {
    return this.#fetch(this.#config.httpUrl + '/ingress/networks', options)
  }

  /**
   * Checks the health of the service.
   *
   * @public
   * @param options - The request options (fetch compatible)
   * @returns A promise that resolves with the health status.
   */
  async health(options?: RequestOptions): Promise<HealthResponse> {
    return this.#fetch(this.#config.httpUrl + '/health', options)
  }
}
