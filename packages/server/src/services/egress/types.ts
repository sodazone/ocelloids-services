import { NetworkURN, TypedEventEmitter } from '../index.js'
import { AnyJson, Subscription } from '../subscriptions/types.js'
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
  }
  payload: T
}

export type PublisherEvents = {
  log: (sub: Subscription, msg: Message) => void
  webhook: (sub: Subscription, msg: Message) => void
  websocket: (sub: Subscription, msg: Message) => void
}

export type PublisherEmitter = TypedEventEmitter<PublisherEvents & TelemetryPublisherEvents>

export interface Publisher extends PublisherEmitter {
  publish(sub: Subscription, msg: Message): void | Promise<void>
}
