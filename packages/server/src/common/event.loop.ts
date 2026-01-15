/**
 * @returns a promise that resolves when the next loop turn is reached,
 * after pending I/O is processed
 */
export function immediate(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

/**
 * @returns a promise that resolves within the same loop turn,
 * before the event loop continues to I/O
 */
export function microtask(): Promise<void> {
  return new Promise<void>(queueMicrotask)
}
