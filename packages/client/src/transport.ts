import { WebSocket } from 'isows'
import ky from 'ky'
import { Options } from 'ky'

import { AnyJson } from './lib'

import { OcelloidsClientConfig } from './client'
import { Protocol } from './protocol'
import {
  AuthReply,
  OnDemandSubscriptionHandlers,
  Subscription,
  SubscriptionError,
  WebSocketHandlers,
  WsAuthErrorEvent,
  isSubscription,
  isSubscriptionError,
} from './types'

/**
 * Returns HTTP headers from configuration.
 *
 * @private
 */
function headersFromConfig(config: OcelloidsClientConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }
  return headers
}

/**
 * Curried fetch function.
 */
export type FetchFn = <T>(url: string, init?: Options | undefined) => Promise<T>

/**
 * Returns a {@link FetchFn} from the given config.
 */
export function doFetchWithConfig<T>(config: OcelloidsClientConfig) {
  const headers = headersFromConfig(config)
  return (url: string, options?: Options) => doFetch<T>(url, headers, options)
}

/**
 * Performs an HTTP fetch request and handles the response.
 *
 * @param url - The URL to send the fetch request to.
 * @param headers - The headers to include in the fetch request.
 * @param options - Optional ky request initialization parameters.
 * @returns A promise that resolves with the response data or rejects with an error.
 */
export function doFetch<T>(url: string, headers: Record<string, string>, options?: Options) {
  return ky(url, {
    headers,
    ...options,
  }).json<T>()
}

type OnDemandWithAgent<T> = {
  agent: string
  args: T
  ephemeral: boolean
}

/**
 * Establishes a WebSocket connection and handles message protocols.
 *
 * @param config - The configuration for the Ocelloids client.
 * @param url - The WebSocket URL to connect to.
 * @param wsHandlers - The event handlers for the WebSocket.
 * @param onDemandSub - Optional on-demand subscription details and handlers.
 * @returns The WebSocket instance.
 */
export function openWebSocket<T, P = AnyJson>(
  config: OcelloidsClientConfig,
  url: string,
  { onMessage, onAuthError, onError, onClose }: WebSocketHandlers<P>,
  onDemandSub?: {
    sub: OnDemandWithAgent<T>
    onDemandHandlers?: OnDemandSubscriptionHandlers<T>
  },
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

  /**
   * Sends an on-demand subscription request.
   * Throws an error if the on-demand subscription is not defined.
   */
  function requestOnDemandSub() {
    if (onDemandSub === undefined) {
      throw new Error('on demand subscription must be defined')
    }
    const { sub, onDemandHandlers } = onDemandSub

    protocol.next<Subscription<T> | SubscriptionError>((msg) => {
      if (onDemandHandlers?.onSubscriptionCreated && isSubscription(msg)) {
        onDemandHandlers.onSubscriptionCreated(msg)
      } else if (onDemandHandlers?.onSubscriptionError && isSubscriptionError(msg)) {
        onDemandHandlers.onSubscriptionError(msg)
      } else if (onDemandHandlers?.onError) {
        onDemandHandlers.onError(msg)
      }
    })

    ws.send(JSON.stringify(sub))
  }

  ws.onopen = () => {
    if (ws.readyState !== 1) {
      ws.dispatchEvent(new Event('error'))
      return
    }

    if (config.apiKey) {
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
      ws.send(config.apiKey)
    } else if (onDemandSub) {
      requestOnDemandSub()
    }
  }

  return ws
}
