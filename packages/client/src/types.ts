import { NotifyMessage } from './lib'

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
  id: string

  /**
   * The agent id.
   */
  agent: string

  /**
   * The specific agent inputs.
   */
  args: T

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
 * Represents an on-demand subscription.
 *
 * @public
 */
export type OnDemandSubscription<T = AnySubscriptionInputs> = Omit<Subscription<T>, 'id' | 'channels'>

/**
 * Subscription identifier.
 *
 * @public
 */
export type SubscriptionId = {
  id: string
  agent: string
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
export type WebSocketHandlers = {
  /**
   * Called on every {@link NotifyMessage}.
   * This is the main message handling callback.
   */
  onMessage: MessageHandler<NotifyMessage>

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
export type OnDemandSubscriptionHandlers = {
  onSubscriptionCreated?: (sub: Subscription) => void
  onSubscriptionError?: (err: SubscriptionError) => void
  onError?: (err: any) => void
}

/**
 * Guard condition for {@link Subscription}.
 *
 * @public
 */
export function isSubscription(obj: Subscription | SubscriptionError | NotifyMessage): obj is Subscription {
  const maybeSub = obj as Subscription
  return maybeSub.channels !== undefined && maybeSub.agent !== undefined && maybeSub.id !== undefined
}

/**
 * Guard condition for {@link SubscriptionError}.
 *
 * @public
 */
export function isSubscriptionError(obj: Subscription | SubscriptionError): obj is SubscriptionError {
  const maybeError = obj as SubscriptionError
  return maybeError.issues !== undefined && maybeError.name !== undefined
}
