import { AgentId, AnyJson, Message, SubscriptionId } from './lib'

/**
 * Represents a {@link Subscription} delivery channel.
 *
 * @public
 */
export type DeliveryChannel =
  | {
      type: 'webhook'
      url: string
      contentType?: string
      events?: '*' | string[]
      template?: string
      bearer?: string
      limit?: number
    }
  | {
      type: 'log'
    }
  | {
      type: 'websocket'
    }

/**
 * Generic subscription inputs placeholder type.
 *
 * @public
 */
export type AnySubscriptionInputs = Record<string, any>

/**
 * Represents a persistent subscription.
 *
 * @example
 * ```typescript
 * {
 *   id: "polkadot-transfers",
 *   agent: "xcm",
 *   args: {
 *     origin: "0",
 *     senders: "*",
 *     destinations: [
 *       "2000",
 *       "1000"
 *     ],
 *     events: "*",
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
 * }
 * ```
 *
 * @public
 */
export type Subscription<T = AnySubscriptionInputs> = {
  /**
   * The subscription id.
   * Must be unique.
   */
  id: SubscriptionId

  /**
   * The agent id.
   */
  agent: AgentId

  /**
   * The specific agent inputs.
   */
  args: T

  /**
   * Indicates a public scope.
   */
  public?: boolean

  /**
   * Indicates the persistence preference.
   */
  ephemeral?: boolean

  /**
   * An array of delivery channels.
   */
  channels: DeliveryChannel[]
}

/**
 * Represents a subscription error.
 *
 * @public
 */
export type SubscriptionError = {
  name: string
  issues: {
    code: string
    expected: string
    path: string[]
    message: string
  }[]
}

/**
 * Authentication reply.
 *
 * @public
 */
export type AuthReply = {
  code: number
  error: boolean
  reason?: string
}

/**
 * WebSockets auth error event.
 *
 * @public
 */
export class WsAuthErrorEvent extends Event {
  name = 'WsAuthError'

  reply: AuthReply

  constructor(reply: AuthReply) {
    super('error')

    this.reply = reply
  }
}

/**
 * Handler for messages delivered by the subscription.
 *
 * @public
 */
export type MessageHandler<T> = (message: T, ws: WebSocket, event: MessageEvent) => void

/**
 * Handler for WebSocket close event.
 *
 * @public
 */
export type CloseHandler = (event: CloseEvent) => void

/**
 * Handler for WebSocket errors.
 *
 * @public
 */
export type ErrorHandler = (error: Event) => void

/**
 * Type definition for WebSocket event handlers.
 *
 * @public
 */
export type WebSocketHandlers<T = AnyJson> = {
  /**
   * Called on every {@link Message}.
   * This is the main message handling callback.
   */
  onMessage: MessageHandler<Message<T>>

  /**
   * Called if the authentication fails.
   */
  onAuthError?: MessageHandler<AuthReply>

  /**
   * Called on WebSocket close.
   */
  onClose?: CloseHandler

  /**
   * Called on WebSocket error.
   */
  onError?: ErrorHandler
}

/**
 * Handlers for on-demand subscription creation.
 *
 * @public
 */
export type OnDemandSubscriptionHandlers<T = AnySubscriptionInputs> = {
  onSubscriptionCreated?: (sub: Subscription<T>) => void
  onSubscriptionError?: (err: SubscriptionError) => void
  onError?: (err: any) => void
}

/**
 * Guard condition for {@link Subscription}.
 *
 * @public
 */
export function isSubscription<T = AnySubscriptionInputs>(
  obj: Subscription<T> | SubscriptionError | Message,
): obj is Subscription<T> {
  const maybeSub = obj as Subscription
  return maybeSub.agent !== undefined && maybeSub.args !== undefined
}

/**
 * Guard condition for {@link SubscriptionError}.
 *
 * @public
 */
export function isSubscriptionError<T = AnySubscriptionInputs>(
  obj: Subscription<T> | SubscriptionError,
): obj is SubscriptionError {
  const maybeError = obj as SubscriptionError
  return maybeError.issues !== undefined && maybeError.name !== undefined
}
