import { XcmNotifyMessage, XcmReceived, XcmRelayed, XcmSent } from './lib'

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
 * Represents a persistent subscription.
 *
 * @example
 * ```typescript
 * {
 *   id: "polkadot-transfers",
 *   origin: "0",
 *   senders: "*",
 *   destinations: [
 *     "2000",
 *     "1000"
 *   ],
 *   events: "*",
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
export type Subscription = {
  /**
   * The subscription id.
   * Must be unique.
   */
  id: string

  /**
   * The origin chain id.
   */
  origin: string

  /**
   * An array of sender addresses or '*' for all.
   */
  senders?: '*' | string[]

  /**
   * An array of destination chain ids.
   */
  destinations: string[]

  /**
   * Indicates the persistence preference.
   */
  ephemeral?: boolean

  /**
   * An array of delivery channels.
   */
  channels: DeliveryChannel[]

  /**
   * An optional array with the events to deliver.
   * Use '*' for all.
   * @see {@link XcmNotificationType} for supported event names.
   */
  events?: '*' | string[]
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
 * The XCM event types.
 *
 * @public
 */
export enum XcmNotificationType {
  Sent = 'xcm.sent',
  Received = 'xcm.received',
  Relayed = 'xcm.relayed',
  Timeout = 'xcm.timeout',
  Hop = 'xcm.hop',
}

/**
 * Represents an on-demand subscription.
 *
 * @public
 */
export type OnDemandSubscription = Omit<Subscription, 'id' | 'channels'>

/**
 * Authentication reply.
 */
export type AuthReply = {
  code: number
  error: boolean
  reason?: string
}

/**
 * WebSockets auth error event.
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
   * Called on every {@link XcmNotifyMessage}.
   * This is the main message handling callback.
   */
  onMessage: MessageHandler<XcmNotifyMessage>

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
export function isSubscription(obj: Subscription | SubscriptionError | XcmNotifyMessage): obj is Subscription {
  const maybeSub = obj as Subscription
  return (
    maybeSub.origin !== undefined &&
    maybeSub.destinations !== undefined &&
    maybeSub.id !== undefined &&
    maybeSub.channels !== undefined
  )
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

/**
 * Guard condition for {@link XcmSent}.
 *
 * @public
 */
export function isXcmSent(object: any): object is XcmSent {
  return object.type !== undefined && object.type === XcmNotificationType.Sent
}

/**
 * Guard condition for {@link XcmReceived}.
 *
 * @public
 */
export function isXcmReceived(object: any): object is XcmReceived {
  return object.type !== undefined && object.type === XcmNotificationType.Received
}

/**
 * Guard condition for {@link XcmRelayed}.
 *
 * @public
 */
export function isXcmRelayed(object: any): object is XcmRelayed {
  return object.type !== undefined && object.type === XcmNotificationType.Relayed
}
