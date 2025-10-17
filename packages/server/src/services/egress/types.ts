import { AnyJson, NetworkURN, TypedEventEmitter } from '../index.js'
import { Subscription } from '../subscriptions/types.js'
import { TelemetryPublisherEvents } from '../telemetry/types.js'

/**
 * The generic message.
 *
 * @public
 */
export type Message<T = AnyJson> = {
  metadata: {
    type: string
    agentId: string
    subscriptionId: string
    networkId: NetworkURN
    timestamp: number
    blockTimestamp?: number
  }
  payload: T
}

export type PublisherEvents = {
  log: (sub: Subscription, msg: Message) => void
  webhook: (sub: Subscription, msg: Message) => void
  websocket: (sub: Subscription, msg: Message) => void
  telegram: (sub: Subscription, msg: Message) => void
  terminate: (sub: Subscription) => void
}

export type PublisherEmitter = TypedEventEmitter<PublisherEvents & TelemetryPublisherEvents>

export interface Publisher extends PublisherEmitter {
  publish(sub: Subscription, msg: Message): void | Promise<void>
}
