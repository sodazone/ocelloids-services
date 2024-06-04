import { type MessageEvent } from 'isows'

import type { NotifyMessage } from './server-types'
import { type MessageHandler } from './types'

/**
 * Type guard to check if a value is a Blob.
 *
 * @param value - The value to check.
 * @returns whether the value is a Blob.
 *
 * @private
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
export class Protocol {
  readonly #queue: MessageHandler<any>[] = []
  readonly #stream: MessageHandler<NotifyMessage>
  #isStreaming: boolean

  /**
   * Constructs a Protocol instance.
   *
   * @param stream - The message handler for streaming state.
   */
  constructor(stream: MessageHandler<NotifyMessage>) {
    this.#stream = stream
    this.#isStreaming = false
  }

  /**
   * Adds a handler to the message queue.
   *
   * @template T - The type of the message.
   * @param handler - The message handler to add.
   */
  next<T>(handler: MessageHandler<T>) {
    this.#queue.push(handler)
  }

  /**
   * Handles a WebSocket message event.
   *
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
